'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Device } from '@/lib/devices-data'
import type { ProductionRun } from '@/lib/production-data'
import {
  createInitialMonitoringState,
  confirmDataEvent,
  confirmQuery,
  nodeStatusFromObservations,
  toMonitoringView,
} from '@/lib/monitoring-store'
import type { MonitoringView, NodeObservation, ServiceStatus, SourceSync } from '@/lib/monitoring-types'
import { recordSourceDataEvent, recordSourceQuery } from '@/lib/sync-store'
import { mergeDeviceUpdate, reconcileDeviceSnapshot } from '@/lib/telemetry'
import { isRecord, parseDeviceEventPayload, parseDevicesPayload, parseProductionPayload } from '@/lib/monitoring-runtime'

const PROBE_INTERVAL_MS = 30_000
const VISUAL_REVIEW_MS = 5_000
const REQUEST_TIMEOUT_MS = 8_000

type StreamName = 'lotes' | 'nodos'
type StreamState = 'open' | 'error' | 'closed'
type ProductionListener = (run: ProductionRun) => void

export type MonitoringActions = {
  reportCamera: (status: ServiceStatus) => void
  seedNodes: (devices: Device[], lastQueryAt: string | null) => void
  refreshNodes: () => Promise<Device[] | null>
  acceptNodeEvent: (payload: unknown) => boolean
  streamState: (source: StreamName, state: StreamState, detail?: string) => void
  acceptLoteEvent: (payload: unknown) => boolean
  subscribeProduction: (listener: ProductionListener) => () => void
  confirmSourceQuery: (source: StreamName, at: string) => void
}

type MonitoringContextValue = {
  view: MonitoringView
  actions: MonitoringActions
  nodes: Device[] | null
}

const MonitoringContext = createContext<MonitoringContextValue | null>(null)

const fallbackView = toMonitoringView(createInitialMonitoringState())
const fallbackUnsubscribe = () => undefined
const fallbackActions: MonitoringActions = {
  reportCamera: () => undefined,
  seedNodes: () => undefined,
  refreshNodes: async () => null,
  acceptNodeEvent: () => false,
  streamState: () => undefined,
  acceptLoteEvent: () => false,
  subscribeProduction: () => fallbackUnsubscribe,
  confirmSourceQuery: () => undefined,
}

function mergeObservedDevice(current: Device, incoming: Device): Device {
  const merged = mergeDeviceUpdate(current, incoming)
  return { ...merged, lastSeen: incoming.lastSeen || current.lastSeen }
}

function asUnknownNodeObservation(
  current: ServiceStatus & { online: number; offline: number; unknown: number },
  detail: string,
) {
  return { ...current, availability: 'unknown' as const, checkedAt: null, detail }
}

type JsonResult = { response: Response; payload: unknown }

async function fetchJson(path: string, parentSignal: AbortSignal): Promise<JsonResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  parentSignal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(path, { cache: 'no-store', signal: controller.signal })
    const payload: unknown = await response.json().catch(() => null)
    return { response, payload }
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error('La consulta excedió el tiempo de espera.')
      timeoutError.name = 'TimeoutError'
      throw timeoutError
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    parentSignal.removeEventListener('abort', abort)
  }
}

function readBackendStatus(result: JsonResult): ServiceStatus {
  const checkedAt = new Date().toISOString()
  const { response, payload } = result
  if (response.status === 200 && isRecord(payload) && payload.status === 'healthy') {
    return { availability: 'available', checkedAt, detail: 'Backend saludable.' }
  }
  if (response.status === 503 && isRecord(payload) && payload.status === 'unhealthy') {
    return {
      availability: 'degraded',
      checkedAt,
      detail: typeof payload.reason === 'string' ? payload.reason : 'Backend con disponibilidad parcial.',
    }
  }
  if (response.status === 502 || response.status === 504) {
    return { availability: 'disconnected', checkedAt, detail: 'El backend no responde desde el panel.' }
  }
  if (response.status === 401 || response.status === 403) {
    return { availability: 'unknown', checkedAt, detail: 'Sesión no autorizada para consultar la salud del backend.' }
  }
  return { availability: 'unknown', checkedAt, detail: 'La respuesta de salud del backend no es válida.' }
}

function productionPayload(payload: unknown): ProductionRun | null {
  if (!isRecord(payload) || ('success' in payload && payload.success !== true)) return null
  const value = 'data' in payload ? payload.data : payload
  return parseProductionPayload([value])?.[0] ?? null
}

function MonitoringProviderRuntime({ children }: { children?: React.ReactNode }) {
  const [state, setState] = useState(createInitialMonitoringState)
  const [nodes, setNodes] = useState<Device[] | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [transport, setTransport] = useState<Record<StreamName, string | null>>({ lotes: null, nodos: null })
  const nodesRef = useRef<Device[] | null>(null)
  const nodeObservationsRef = useRef<Record<string, NodeObservation>>({})
  const inventoryObservedAtRef = useRef<string | null>(null)
  const nodeSnapshotAtRef = useRef<string | null>(null)
  const nodeEventsRef = useRef<Array<{ version: number; device: Device; observedAt: string }>>([])
  const nodeVersionRef = useRef(0)
  const nodeRefreshRef = useRef<Promise<Device[] | null> | null>(null)
  const probeRef = useRef<Promise<void> | null>(null)
  const productionListenersRef = useRef(new Set<ProductionListener>())
  const productionIdsRef = useRef(new Set<string>())
  const controllersRef = useRef(new Set<AbortController>())
  const generationRef = useRef(0)
  const mountedRef = useRef(false)

  const visible = useCallback(() => typeof document === 'undefined' || document.visibilityState === 'visible', [])
  const active = useCallback((generation: number) => mountedRef.current && generationRef.current === generation && visible(), [visible])

  const updateSync = useCallback((source: StreamName, transition: (current: SourceSync) => SourceSync) => {
    setState((current) => ({ ...current, sync: { ...current.sync, [source]: transition(current.sync[source]) } }))
  }, [])

  const confirmSourceQuery = useCallback((source: StreamName, at: string) => {
    updateSync(source, (current) => recordSourceQuery(current, at))
  }, [updateSync])

  const reportCamera = useCallback((status: ServiceStatus) => {
    setState((current) => ({ ...current, camera: status }))
  }, [])

  const seedNodes = useCallback((devices: Device[], lastQueryAt: string | null) => {
    if (!lastQueryAt || !Number.isFinite(Date.parse(lastQueryAt))) return
    if (nodeSnapshotAtRef.current && Date.parse(lastQueryAt) <= Date.parse(nodeSnapshotAtRef.current)) return

    const observations: Record<string, NodeObservation> = Object.fromEntries(
      devices.map((device) => [device.dispositivoId, { device, observedAt: lastQueryAt }]),
    )
    const eventsAfterSnapshot = nodeEventsRef.current.filter((event) => Date.parse(event.observedAt) >= Date.parse(lastQueryAt))
    for (const event of eventsAfterSnapshot) {
      const existing = observations[event.device.dispositivoId]?.device
      observations[event.device.dispositivoId] = {
        device: existing ? mergeObservedDevice(existing, event.device) : event.device,
        observedAt: event.observedAt,
      }
    }
    nodeObservationsRef.current = observations
    inventoryObservedAtRef.current = lastQueryAt
    nodeSnapshotAtRef.current = lastQueryAt
    const seeded = Object.values(observations).map((observation) => observation.device)
    nodesRef.current = seeded
    setNodes(seeded)
    setState((current) => ({
      ...current,
      nodeObservations: observations,
      inventoryObservedAt: lastQueryAt,
      nodes: nodeStatusFromObservations(observations, lastQueryAt, Date.now()),
      sync: { ...current.sync, nodos: confirmQuery(current.sync.nodos, lastQueryAt) },
    }))
  }, [])

  const refreshNodes = useCallback(async (): Promise<Device[] | null> => {
    if (!visible() || !mountedRef.current) return null
    if (nodeRefreshRef.current) return nodeRefreshRef.current
    const generation = generationRef.current
    const requestedNodeVersion = nodeVersionRef.current
    const requestedSnapshotAt = new Date().toISOString()
    const controller = new AbortController()
    controllersRef.current.add(controller)
    let request: Promise<Device[] | null> | null = null
    request = (async () => {
      try {
        const { response, payload } = await fetchJson('/api/nodos/snapshot', controller.signal)
        if (!active(generation)) return null
        if (response.status === 401 || response.status === 403) {
          inventoryObservedAtRef.current = null
          setState((current) => ({ ...current, nodeObservations: undefined, inventoryObservedAt: null, nodes: asUnknownNodeObservation(current.nodes, 'Sesión no autorizada para consultar nodos.') }))
          return null
        }
        if (!response.ok) {
          inventoryObservedAtRef.current = null
          setState((current) => ({ ...current, nodeObservations: undefined, inventoryObservedAt: null, nodes: asUnknownNodeObservation(current.nodes, 'La respuesta de nodos no es válida.') }))
          return null
        }
        const snapshot = parseDevicesPayload(payload)
        if (!snapshot) {
          inventoryObservedAtRef.current = null
          setState((current) => ({ ...current, nodeObservations: undefined, inventoryObservedAt: null, nodes: asUnknownNodeObservation(current.nodes, 'La respuesta de nodos no es válida.') }))
          return null
        }
        if (nodeSnapshotAtRef.current && Date.parse(requestedSnapshotAt) <= Date.parse(nodeSnapshotAtRef.current)) return null
        let nextDevices = reconcileDeviceSnapshot([], snapshot)
        const nextObservations: Record<string, NodeObservation> = Object.fromEntries(
          nextDevices.map((device) => [device.dispositivoId, { device, observedAt: requestedSnapshotAt }]),
        )
        for (const event of nodeEventsRef.current) {
          if (event.version <= requestedNodeVersion) continue
          const existing = nextObservations[event.device.dispositivoId]?.device
          nextObservations[event.device.dispositivoId] = {
            device: existing ? mergeObservedDevice(existing, event.device) : event.device,
            observedAt: event.observedAt,
          }
        }
        nextDevices = Object.values(nextObservations).map((observation) => observation.device)
        if (!active(generation)) return null
        const checkedAt = requestedSnapshotAt
        nodesRef.current = nextDevices
        nodeObservationsRef.current = nextObservations
        inventoryObservedAtRef.current = checkedAt
        nodeSnapshotAtRef.current = checkedAt
        setNodes(nextDevices)
        setState((currentState) => ({
          ...currentState,
          nodeObservations: nextObservations,
          inventoryObservedAt: checkedAt,
          nodes: nodeStatusFromObservations(nextObservations, checkedAt, Date.now()),
          sync: { ...currentState.sync, nodos: confirmQuery(currentState.sync.nodos, checkedAt) },
        }))
        return nextDevices
      } catch (error) {
        if (active(generation) && !(error instanceof Error && error.name === 'AbortError')) {
          setState((current) => ({ ...current, nodes: asUnknownNodeObservation(current.nodes, 'No se pudo observar la flota desde el panel.') }))
        }
        return null
      } finally {
        controllersRef.current.delete(controller)
        if (nodeRefreshRef.current === request) nodeRefreshRef.current = null
      }
    })()
    nodeRefreshRef.current = request
    return request
  }, [active, visible])

  const acceptNodeEvent = useCallback((payload: unknown): boolean => {
    const update = parseDeviceEventPayload(payload)
    if (!update || !mountedRef.current || !visible()) return false
    const version = nodeVersionRef.current + 1
    nodeVersionRef.current = version
    const observedAt = new Date().toISOString()
    nodeEventsRef.current = [...nodeEventsRef.current.slice(-99), { version, device: update, observedAt }]
    const current = nodesRef.current ?? []
    const existing = current.find((device) => device.dispositivoId === update.dispositivoId)
    const observedDevice = existing ? mergeObservedDevice(existing, update) : update
    const next = existing
      ? current.map((device) => device.dispositivoId === update.dispositivoId ? observedDevice : device)
      : [...current, update]
    nodesRef.current = next
    nodeObservationsRef.current = {
      ...nodeObservationsRef.current,
      [update.dispositivoId]: {
        device: observedDevice,
        observedAt,
      },
    }
    setNodes(next)
    // An event observes one node; it is not an inventory confirmation for the fleet.
    setState((currentState) => {
      const observations = nodeObservationsRef.current
      return {
        ...currentState,
        nodeObservations: observations,
        nodes: nodeStatusFromObservations(observations, inventoryObservedAtRef.current, Date.now()),
        sync: { ...currentState.sync, nodos: confirmDataEvent(currentState.sync.nodos, observedAt) },
      }
    })
    return true
  }, [visible])

  const streamState = useCallback((source: StreamName, stream: StreamState, detail?: string) => {
    setTransport((current) => ({ ...current, [source]: stream === 'error' ? detail ?? 'El stream no está disponible.' : null }))
  }, [])

  const subscribeProduction = useCallback((listener: ProductionListener) => {
    productionListenersRef.current.add(listener)
    return () => productionListenersRef.current.delete(listener)
  }, [])

  const acceptLoteEvent = useCallback((payload: unknown): boolean => {
    const run = productionPayload(payload)
    if (!run || !mountedRef.current || !visible()) return false
    productionIdsRef.current.add(run.id)
    productionListenersRef.current.forEach((listener) => listener(run))
    updateSync('lotes', (current) => recordSourceDataEvent(current, new Date().toISOString()))
    return true
  }, [updateSync, visible])

  const probe = useCallback(async (force = false) => {
    if (!visible() || !mountedRef.current) return
    if (probeRef.current && !force) return probeRef.current
    if (probeRef.current) return probeRef.current
    const generation = generationRef.current
    const controller = new AbortController()
    controllersRef.current.add(controller)
    let request: Promise<void> | null = null
    request = (async () => {
      try {
        const result = await fetchJson('/api/system-status', controller.signal)
        if (active(generation)) setState((current) => ({ ...current, backend: readBackendStatus(result) }))
      } catch (error) {
        if (active(generation) && !(error instanceof Error && error.name === 'AbortError')) {
          setState((current) => ({ ...current, backend: { availability: 'disconnected', checkedAt: new Date().toISOString(), detail: 'No se pudo contactar desde el panel.' } }))
        }
      } finally {
        controllersRef.current.delete(controller)
        if (probeRef.current === request) probeRef.current = null
      }
    })()
    probeRef.current = request
    await Promise.all([request, refreshNodes()])
  }, [active, refreshNodes, visible])

  useEffect(() => {
    mountedRef.current = true
    const activeControllers = controllersRef.current
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      activeControllers.forEach((controller) => controller.abort())
      activeControllers.clear()
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    let reviewTimer: number | undefined
    let probeTimer: number | undefined
    let cancelled = false

    const cancelRequests = () => {
      generationRef.current += 1
      controllersRef.current.forEach((controller) => controller.abort())
      controllersRef.current.clear()
      nodeRefreshRef.current = null
      probeRef.current = null
    }
    const scheduleReview = () => {
      if (cancelled) return
      reviewTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') setClock(Date.now())
        scheduleReview()
      }, VISUAL_REVIEW_MS)
    }
    const scheduleProbe = () => {
      if (cancelled) return
      probeTimer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await probe()
        scheduleProbe()
      }, PROBE_INTERVAL_MS)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cancelRequests()
        return
      }
      generationRef.current += 1
      setClock(Date.now())
      void probe(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    scheduleReview()
    scheduleProbe()
    if (document.visibilityState === 'visible') void probe(true)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (reviewTimer !== undefined) window.clearTimeout(reviewTimer)
      if (probeTimer !== undefined) window.clearTimeout(probeTimer)
      cancelRequests()
    }
  }, [probe])

  const actions = useMemo<MonitoringActions>(() => ({
    reportCamera,
    seedNodes,
    refreshNodes,
    acceptNodeEvent,
    streamState,
    acceptLoteEvent,
    subscribeProduction,
    confirmSourceQuery,
  }), [acceptLoteEvent, acceptNodeEvent, confirmSourceQuery, refreshNodes, reportCamera, seedNodes, streamState, subscribeProduction])
  const view = useMemo(() => {
    const current = toMonitoringView(state, clock, Boolean(transport.lotes || transport.nodos))
    const transportDetails = [transport.lotes, transport.nodos].filter(Boolean).join(' ')
    return transportDetails ? { ...current, overall: { ...current.overall, detail: `${current.overall.detail} ${transportDetails}` } } : current
  }, [clock, state, transport])

  return <MonitoringContext.Provider value={{ view, actions, nodes }}>{children}</MonitoringContext.Provider>
}

/**
 * A session change is a runtime boundary, not just a state transition. The
 * keyed child guarantees that requests, listeners, journals and hook-local
 * state from the previous identity cannot leak into the new subtree.
 */
export function MonitoringProvider({ children, sessionKey = 'anonymous' }: { children?: React.ReactNode; sessionKey?: string }) {
  return <MonitoringProviderRuntime key={sessionKey}>{children}</MonitoringProviderRuntime>
}

export function useMonitoring(): MonitoringView {
  return useContext(MonitoringContext)?.view ?? fallbackView
}

export function useMonitoringActions(): MonitoringActions {
  return useContext(MonitoringContext)?.actions ?? fallbackActions
}

export function useMonitoringNodes(): Device[] | null {
  return useContext(MonitoringContext)?.nodes ?? null
}

export function useProductionData(
  initialRuns: ProductionRun[],
  initialLastSyncAt: string | null,
  initialError?: string | null,
): { runs: ProductionRun[]; lastSyncAt: string | null; error: string | null; loading: boolean; refresh: () => Promise<void> } {
  const context = useContext(MonitoringContext)
  const actions = context?.actions ?? fallbackActions
  const monitoring = context?.view ?? fallbackView
  const hasContext = context !== null
  const [runs, setRuns] = useState(initialRuns)
  const [error, setError] = useState(initialError ?? null)
  const [loading, setLoading] = useState(false)
  const eventVersionRef = useRef(0)
  const eventsRef = useRef<Array<{ version: number; run: ProductionRun; observedAt: string }>>([])
  const acceptedSnapshotAtRef = useRef<string | null>(
    initialLastSyncAt && Number.isFinite(Date.parse(initialLastSyncAt)) ? initialLastSyncAt : null,
  )
  const requestRef = useRef<Promise<void> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (initialError) {
      // A failed server refresh has no snapshot timestamp. It must never
      // replace data that was already confirmed in this mounted runtime.
      return
    }
    if (!initialLastSyncAt || !Number.isFinite(Date.parse(initialLastSyncAt))) return
    const snapshotAt = Date.parse(initialLastSyncAt)
    const acceptedAt = acceptedSnapshotAtRef.current ? Date.parse(acceptedSnapshotAtRef.current) : NaN
    const latestEventAt = eventsRef.current.reduce((latest, event) => Math.max(latest, Date.parse(event.observedAt)), -Infinity)
    if (Number.isFinite(acceptedAt) && snapshotAt <= acceptedAt) return
    if (Number.isFinite(latestEventAt) && snapshotAt < latestEventAt) return

    acceptedSnapshotAtRef.current = initialLastSyncAt
    const replay = eventsRef.current.filter((event) => Date.parse(event.observedAt) > snapshotAt)
    const nextRuns = new Map(initialRuns.map((run) => [run.id, run]))
    for (const event of replay) nextRuns.set(event.run.id, event.run)
    eventsRef.current = replay
    setRuns([...nextRuns.values()])
    setError(null)
  }, [initialError, initialLastSyncAt, initialRuns])

  useEffect(() => {
    if (!hasContext) return
    if (initialLastSyncAt) actions.confirmSourceQuery('lotes', initialLastSyncAt)
  }, [actions, hasContext, initialLastSyncAt])

  useEffect(() => {
    if (!hasContext) return
    return actions.subscribeProduction((run) => {
      eventVersionRef.current += 1
      eventsRef.current = [...eventsRef.current.slice(-99), {
        version: eventVersionRef.current,
        run,
        observedAt: new Date().toISOString(),
      }]
      setRuns((current) => {
        const index = current.findIndex((item) => item.id === run.id)
        return index < 0 ? [run, ...current] : current.map((item, itemIndex) => itemIndex === index ? run : item)
      })
      setError(null)
    })
  }, [actions, hasContext])

  const refresh = useCallback(async () => {
    if (!hasContext || typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (requestRef.current) return requestRef.current
    const generation = generationRef.current
    const controller = new AbortController()
    controllerRef.current = controller
    const requestedEventVersion = eventVersionRef.current
    const requestedSnapshotAt = new Date().toISOString()
    let request: Promise<void> | null = null
    request = (async () => {
      setLoading(true)
      try {
        const { response, payload } = await fetchJson('/api/lotes/snapshot', controller.signal)
        if (!mountedRef.current || generationRef.current !== generation || document.visibilityState !== 'visible') return
        if (!response.ok) throw new Error(`La API respondió con ${response.status}.`)
        const nextRuns = parseProductionPayload(payload)
        if (!nextRuns) throw new Error('La API de lotes devolvió una respuesta inválida.')
        const requestedAt = Date.parse(requestedSnapshotAt)
        const acceptedAt = acceptedSnapshotAtRef.current ? Date.parse(acceptedSnapshotAtRef.current) : NaN
        if (Number.isFinite(acceptedAt) && requestedAt < acceptedAt) return
        const merged = new Map(nextRuns.map((run) => [run.id, run]))
        for (const event of eventsRef.current) {
          if (event.version > requestedEventVersion) {
            merged.set(event.run.id, event.run)
          }
        }
        acceptedSnapshotAtRef.current = requestedSnapshotAt
        eventsRef.current = eventsRef.current.filter((event) => Date.parse(event.observedAt) > requestedAt)
        setRuns([...merged.values()])
        setError(null)
        actions.confirmSourceQuery('lotes', requestedSnapshotAt)
      } catch (nextError) {
        if (mountedRef.current && generationRef.current === generation && !(nextError instanceof Error && nextError.name === 'AbortError')) {
          setError(nextError instanceof Error ? nextError.message : 'No se pudo cargar la producción.')
        }
      } finally {
        if (mountedRef.current && generationRef.current === generation) setLoading(false)
        if (requestRef.current === request) requestRef.current = null
        if (controllerRef.current === controller) controllerRef.current = null
      }
    })()
    requestRef.current = request
    return request
  }, [actions, hasContext])

  useEffect(() => {
    if (!hasContext || typeof document === 'undefined') return
    mountedRef.current = true
    let timer: number | undefined
    let cancelled = false
    const abort = () => {
      generationRef.current += 1
      controllerRef.current?.abort()
      controllerRef.current = null
      requestRef.current = null
    }
    const schedule = () => {
      if (cancelled) return
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await refresh()
        schedule()
      }, PROBE_INTERVAL_MS)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') abort()
      else {
        generationRef.current += 1
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (document.visibilityState === 'visible') void refresh()
    schedule()
    return () => {
      cancelled = true
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (timer !== undefined) window.clearTimeout(timer)
      abort()
    }
  }, [hasContext, refresh])

  return {
    runs,
    lastSyncAt: monitoring.sync.lotes.lastConfirmedAt ?? initialLastSyncAt,
    error,
    loading,
    refresh,
  }
}
