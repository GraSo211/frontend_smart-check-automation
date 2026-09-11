"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Server } from "lucide-react"
import { DeviceCard } from "@/components/nodos/device-card"
import { DeviceHistory } from "@/components/nodos/device-history"
import { TelemetryDashboard } from "@/components/nodos/telemetry-dashboard"
import { getDeviceHistoryPage } from "@/actions/api"
import { mergeTelemetrySamples, samplesForDevice } from "@/lib/telemetry"
import type { Device, SpecificDevice } from "@/lib/devices-data"
import { parseDeviceEventPayload } from "@/lib/monitoring-runtime"
import { useMonitoringActions, useMonitoringNodes } from "@/components/monitoring-provider"
import { ConnectionIndicator, type ConnectionState } from "@/components/shared/connection-indicator"

const HISTORY_PAGE_SIZE = 20
const RECENT_HISTORY_CAP = 100

interface DevicesStateProps {
  devices: Device[]
  lastSyncAt: string | null
}

function sampleKey(sample: SpecificDevice) {
  return sample.id
    ? `${sample.dispositivoId}|id:${sample.id}`
    : `${sample.dispositivoId}|at:${sample.receivedAt}`
}

type LiveJournalEntry = { sample: SpecificDevice; version: number }

// Client container for the node fleet: selection state, live SSE telemetry
// and the history section of the currently selected device.
export default function DevicesState({ devices: initialDevices, lastSyncAt }: DevicesStateProps) {
  const monitoredDevices = useMonitoringNodes()
  const actions = useMonitoringActions()
  const allDevices = monitoredDevices ?? initialDevices
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  // `history` is the confirmed remote table page. It is never relabelled to a
  // pending page; this is important when a page request fails.
  const [history, setHistory] = useState<SpecificDevice[]>([])
  const [recentHistory, setRecentHistory] = useState<SpecificDevice[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStale, setHistoryStale] = useState(false)
  const [failedHistoryPage, setFailedHistoryPage] = useState<number | null>(null)
  const [newSamples, setNewSamples] = useState(0)
  const [streamState, setStreamState] = useState<ConnectionState>("unknown")
  const [streamRetry, setStreamRetry] = useState(0)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const selectedDeviceIdRef = useRef<string | null>(null)
  const historyPageRef = useRef(1)
  const historyRef = useRef<SpecificDevice[]>([])
  const liveHistoryRef = useRef<SpecificDevice[]>([])
  const liveJournalRef = useRef<LiveJournalEntry[]>([])
  const liveVersionRef = useRef(0)
  const newSamplesBaselineRef = useRef(0)
  const remoteLatestRef = useRef<SpecificDevice[]>([])
  const historyRequestRef = useRef(0)
  const recentRequestRef = useRef(0)
  const selectionEpochRef = useRef(0)
  const mountedRef = useRef(false)
  const historyLoadingRef = useRef(false)
  const historyRequestsInFlightRef = useRef(0)
  const streamEpochRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const syncStreamRef = useRef<((source: EventSource) => void) | null>(null)

  const newLiveSamples = useCallback((remote: SpecificDevice[], sinceVersion = 0) => {
    const remoteKeys = new Set(remote.map(sampleKey))
    const seen = new Set<string>()
    return liveJournalRef.current
      .filter(({ sample, version }) => version > sinceVersion && !remoteKeys.has(sampleKey(sample)))
      .filter(({ sample }) => {
        const key = sampleKey(sample)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(({ sample }) => sample)
  }, [])

  const isCurrentHistoryRequest = useCallback((deviceId: string, epoch: number, request: number) => {
    const current = mountedRef.current && selectedDeviceIdRef.current === deviceId &&
      selectionEpochRef.current === epoch && historyRequestRef.current === request
    return current
  }, [])

  const applyRemoteHistory = useCallback((rows: SpecificDevice[], page: number, total: number, deviceId: string, liveVersionAtStart: number) => {
    const remoteRows = samplesForDevice(rows, deviceId)
    if (page === 1) {
      // API first, then the complete live journal. A report received while the
      // request was pending therefore always wins over an older HTTP value.
      remoteLatestRef.current = remoteRows
      const merged = mergeTelemetrySamples(remoteRows, liveHistoryRef.current)
      historyRef.current = merged.slice(0, HISTORY_PAGE_SIZE)
      setHistory(historyRef.current)
      setRecentHistory(merged.slice(0, RECENT_HISTORY_CAP))
      setHistoryTotal(total)
      setNewSamples(newLiveSamples(remoteRows, liveVersionAtStart).length)
    } else {
      // Live samples are intentionally not mixed into remote pages.
      historyRef.current = remoteRows.slice(0, HISTORY_PAGE_SIZE)
      setHistory(historyRef.current)
      setHistoryTotal(total)
    }
  }, [newLiveSamples])

  const requestHistory = useCallback(async (deviceId: string, page: number, epoch = selectionEpochRef.current, liveVersionAtStart = liveVersionRef.current): Promise<boolean> => {
    if (selectedDeviceIdRef.current !== deviceId || selectionEpochRef.current !== epoch || (typeof document !== "undefined" && document.visibilityState === "hidden")) return false
    const request = ++historyRequestRef.current
    historyRequestsInFlightRef.current += 1
    historyLoadingRef.current = true
    setLoadingHistory(true)
    setHistoryError(null)
    setHistoryStale(false)
    setFailedHistoryPage(null)
    newSamplesBaselineRef.current = liveVersionAtStart
    try {
      let queriedPage = page
      let rows = await getDeviceHistoryPage(deviceId, queriedPage, HISTORY_PAGE_SIZE)
      let safePage = queriedPage
      let stable = false
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (!isCurrentHistoryRequest(deviceId, epoch, request)) return false
        // If the collection shrank while a page was open, the backend response
        // is not evidence that its rows belong to the requested page. Re-query
        // the clamped page before committing, retaining this request token.
        safePage = Math.max(1, Math.min(page, Math.max(1, Math.ceil(rows.total / HISTORY_PAGE_SIZE))))
        if (safePage === queriedPage) {
          stable = true
          break
        }
        queriedPage = safePage
        rows = await getDeviceHistoryPage(deviceId, queriedPage, HISTORY_PAGE_SIZE)
      }
      if (!stable) throw new Error("El historial cambió durante la consulta.")
      applyRemoteHistory(rows.items, safePage, rows.total, deviceId, liveVersionAtStart)
      historyPageRef.current = safePage
      setHistoryPage(safePage)
      setHistoryStale(false)
      setHistoryError(null)
      return true
    } catch (error) {
      if (!isCurrentHistoryRequest(deviceId, epoch, request)) return false
      // Keep the confirmed page and its rows. The presenter can show stale
      // data and retry without pretending this was the requested page.
      setFailedHistoryPage(page)
      setHistoryStale(historyRef.current.length > 0)
      setHistoryError(error instanceof Error ? error.message : "No se pudo cargar el historial. Los reportes históricos no están disponibles.")
      return false
    } finally {
      historyRequestsInFlightRef.current = Math.max(0, historyRequestsInFlightRef.current - 1)
      if (historyRequestsInFlightRef.current === 0) {
        historyLoadingRef.current = false
        if (mountedRef.current) setLoadingHistory(false)
        // The journal is unbounded only for the duration of a request. It is
        // safe to bound it after reconciliation because the API page won.
        liveHistoryRef.current = liveHistoryRef.current.slice(0, RECENT_HISTORY_CAP)
        liveJournalRef.current = liveJournalRef.current.slice(-RECENT_HISTORY_CAP)
      }
    }
  }, [applyRemoteHistory, isCurrentHistoryRequest])

  // On page > 1 the table remains remote-only, while charts still need the
  // latest page. This second request never changes the confirmed table page.
  const requestRecentHistory = useCallback(async (deviceId: string, epoch = selectionEpochRef.current, liveVersionAtStart = liveVersionRef.current, historyRequest = historyRequestRef.current): Promise<boolean> => {
    if (selectedDeviceIdRef.current !== deviceId || selectionEpochRef.current !== epoch || (typeof document !== "undefined" && document.visibilityState === "hidden")) return false
    const request = ++recentRequestRef.current
    historyRequestsInFlightRef.current += 1
    historyLoadingRef.current = true
    setLoadingHistory(true)
    try {
      const rows = await getDeviceHistoryPage(deviceId, 1, HISTORY_PAGE_SIZE)
      if (!mountedRef.current || selectedDeviceIdRef.current !== deviceId || selectionEpochRef.current !== epoch || recentRequestRef.current !== request || historyRequestRef.current !== historyRequest) return false
      const remoteRows = samplesForDevice(rows.items, deviceId)
      remoteLatestRef.current = remoteRows
      const merged = mergeTelemetrySamples(remoteRows, liveHistoryRef.current)
      setRecentHistory(merged.slice(0, RECENT_HISTORY_CAP))
      setNewSamples(newLiveSamples(remoteRows, liveVersionAtStart).length)
      // The table request owns the authoritative total. This auxiliary page-1
      // request only refreshes chart rows and must not race the table state.
      return true
    } catch {
      return false
    } finally {
      historyRequestsInFlightRef.current = Math.max(0, historyRequestsInFlightRef.current - 1)
      if (historyRequestsInFlightRef.current === 0) {
        historyLoadingRef.current = false
        if (mountedRef.current) setLoadingHistory(false)
        liveHistoryRef.current = liveHistoryRef.current.slice(0, RECENT_HISTORY_CAP)
        liveJournalRef.current = liveJournalRef.current.slice(-RECENT_HISTORY_CAP)
      }
    }
  }, [newLiveSamples])

  const refreshSelectedHistory = useCallback(async (deviceId: string, page: number, epoch: number) => {
    const liveVersionAtStart = liveVersionRef.current
    const current = requestHistory(deviceId, page, epoch, liveVersionAtStart)
    if (page === 1) return current
    const historyRequest = historyRequestRef.current
    const [pageOk, recentOk] = await Promise.all([current, requestRecentHistory(deviceId, epoch, liveVersionAtStart, historyRequest)])
    return pageOk && recentOk
  }, [requestHistory, requestRecentHistory])

  useEffect(() => {
    mountedRef.current = true
    actions.seedNodes(initialDevices, lastSyncAt)
    return () => { mountedRef.current = false }
  }, [actions, initialDevices, lastSyncAt])

  useEffect(() => {
    if (typeof window === "undefined") return
    let disposed = false
    let eventSource: EventSource | null = null

    const syncConnection = (current: EventSource) => {
      const syncEpoch = ++streamEpochRef.current
      const deviceId = selectedDeviceIdRef.current
      const selectedEpoch = selectionEpochRef.current
      setStreamState("reconnecting")
      void (async () => {
        // Only the second snapshot certifies this connection. The first may
        // have started before an interruption and be coalesced with old work.
        await actions.refreshNodes()
        const second = await actions.refreshNodes()
        if (disposed || syncEpoch !== streamEpochRef.current || document.visibilityState !== "visible" || current.readyState !== (EventSource.OPEN ?? 1) || selectedDeviceIdRef.current !== deviceId || selectionEpochRef.current !== selectedEpoch) return
        const historyOk = deviceId ? await refreshSelectedHistory(deviceId, historyPageRef.current, selectedEpoch) : true
        if (!disposed && syncEpoch === streamEpochRef.current && document.visibilityState === "visible" && current.readyState === (EventSource.OPEN ?? 1) && second !== null && historyOk) setStreamState("connected")
      })()
    }
    syncStreamRef.current = syncConnection

    const createStream = () => {
      ++streamEpochRef.current
      const current = new EventSource("/api/nodos/events")
      eventSource = current
      eventSourceRef.current = current

      const applyDeviceUpdate = (update: Device, payload: unknown, addToHistory: boolean) => {
        if (!actions.acceptNodeEvent(payload)) return
        if (!addToHistory || !update.ultimaMetrica || selectedDeviceIdRef.current !== update.dispositivoId) return
        const metric = update.ultimaMetrica
        const row: SpecificDevice = {
          id: metric.id,
          dispositivoId: update.dispositivoId,
          nombre: update.nombre,
          cpuPct: metric.cpuPct,
          memRamDisponibleMb: metric.memRamDisponibleMb,
          memRamTotalMb: metric.memRamTotalMb,
          almacenamientoDisponibleMb: metric.almacenamientoDisponibleMb,
          almacenamientoTotalMb: metric.almacenamientoTotalMb,
          tempChip: metric.tempChip,
          aiProcessorPct: metric.aiProcessorPct,
          receivedAt: metric.receivedAt,
        }
        liveVersionRef.current += 1
        liveJournalRef.current = [...liveJournalRef.current, { sample: row, version: liveVersionRef.current }]
        liveHistoryRef.current = mergeTelemetrySamples(liveHistoryRef.current, [row])
        const merged = mergeTelemetrySamples(remoteLatestRef.current, liveHistoryRef.current)
        setRecentHistory(merged.slice(0, historyLoadingRef.current ? undefined : RECENT_HISTORY_CAP))
        setNewSamples(newLiveSamples(remoteLatestRef.current, newSamplesBaselineRef.current).length)
        if (historyPageRef.current === 1) {
          const visible = merged.slice(0, HISTORY_PAGE_SIZE)
          historyRef.current = visible
          setHistory(visible)
        }
      }

      current.addEventListener("dispositivo.metric", (event) => {
        try {
          const payload: unknown = JSON.parse((event as MessageEvent).data)
          const update = parseDeviceEventPayload(payload)
          if (update) applyDeviceUpdate(update, payload, true)
        } catch { /* malformed event cannot confirm synchronization */ }
      })
      current.addEventListener("dispositivo.state", (event) => {
        try {
          const payload: unknown = JSON.parse((event as MessageEvent).data)
          const update = parseDeviceEventPayload(payload)
          if (update) applyDeviceUpdate(update, payload, false)
        } catch { /* malformed event cannot confirm synchronization */ }
      })
      current.onopen = () => {
        actions.streamState("nodos", "open")
        syncConnection(current)
      }
      current.onerror = () => {
        // Invalidate a pending open/snapshot sequence immediately. A later
        // open gets a new epoch, so an old promise cannot promote it to live.
        streamEpochRef.current += 1
        setStreamState(current.readyState === EventSource.CLOSED ? "disconnected" : "reconnecting")
        actions.streamState("nodos", "error", "El stream de nodos no está disponible.")
      }
    }

    createStream()
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        streamEpochRef.current += 1
        setStreamState("reconnecting")
        return
      }
      const current = eventSourceRef.current
      if (current?.readyState === (EventSource.OPEN ?? 1)) syncConnection(current)
      else if (selectedDeviceIdRef.current) void refreshSelectedHistory(selectedDeviceIdRef.current, historyPageRef.current, selectionEpochRef.current)
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      disposed = true
      streamEpochRef.current += 1
      document.removeEventListener("visibilitychange", onVisibilityChange)
      syncStreamRef.current = null
      eventSourceRef.current = null
      eventSource?.close()
      actions.streamState("nodos", "closed")
    }
  }, [actions, newLiveSamples, refreshSelectedHistory, streamRetry])

  const handleSelect = (dispositivoId: string) => {
    // The event handler can run before passive effects have flushed in a
    // client transition; from this point the mounted component owns requests.
    mountedRef.current = true
    const nextSelectedDeviceId = selectedDeviceId === dispositivoId ? null : dispositivoId
    selectedDeviceIdRef.current = nextSelectedDeviceId
    const epoch = ++selectionEpochRef.current
    streamEpochRef.current += 1
    setStreamState("reconnecting")
    setSelectedDeviceId(nextSelectedDeviceId)
    setHistory([])
    setRecentHistory([])
    setHistoryTotal(0)
    historyRef.current = []
    liveHistoryRef.current = []
    liveJournalRef.current = []
    liveVersionRef.current = 0
    newSamplesBaselineRef.current = 0
    remoteLatestRef.current = []
    historyPageRef.current = 1
    setHistoryPage(1)
    setHistoryStale(false)
    setHistoryError(null)
    setFailedHistoryPage(null)
    setNewSamples(0)
    setLoadingHistory(Boolean(nextSelectedDeviceId))
    if (nextSelectedDeviceId) void requestHistory(nextSelectedDeviceId, 1, epoch)
    if (eventSourceRef.current?.readyState === (EventSource.OPEN ?? 1)) syncStreamRef.current?.(eventSourceRef.current)
  }

  // If the selected device is removed, clear the selection so the history
  // panel doesn't keep pointing at a node that no longer exists.
  const handleDeviceDeleted = (dispositivoId: string) => {
    if (selectedDeviceId !== dispositivoId) return
    selectedDeviceIdRef.current = null
    selectionEpochRef.current += 1
    streamEpochRef.current += 1
    setStreamState("reconnecting")
    setSelectedDeviceId(null)
    setHistory([])
    setRecentHistory([])
    setHistoryTotal(0)
    setHistoryError(null)
    setHistoryStale(false)
    setLoadingHistory(false)
    setNewSamples(0)
    historyRef.current = []
    liveHistoryRef.current = []
    liveJournalRef.current = []
    liveVersionRef.current = 0
    newSamplesBaselineRef.current = 0
    remoteLatestRef.current = []
  }

  const selectedDevice = useMemo(
    () => allDevices.find((device) => device.dispositivoId === selectedDeviceId) ?? null,
    [allDevices, selectedDeviceId],
  )

  const onlineCount = allDevices.filter((device) => device.estado === "online").length
  const offlineCount = allDevices.length - onlineCount

  return (
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="nodos-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="nodos-heading" className="text-base font-semibold text-foreground">Nodos de la flota</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Estado en tiempo real y última telemetría de cada dispositivo.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <ConnectionIndicator state={streamState} label="Nodos" detail={streamState === "connected" ? undefined : "La telemetría puede estar desactualizada."} onRetry={() => setStreamRetry((retry) => retry + 1)} disabled={loadingHistory} /> {onlineCount} online · {offlineCount} offline
          </span>
        </div>

        {allDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground"><Server className="size-5" aria-hidden="true" /></span>
            <p className="text-sm font-medium text-foreground">No hay nodos registrados</p>
            <p className="max-w-xs text-xs text-muted-foreground">Cuando se registren dispositivos, vas a poder ver su estado y telemetría acá.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allDevices.map((device) => (
              <DeviceCard key={device.dispositivoId} device={device} selected={selectedDeviceId === device.dispositivoId} onSelect={handleSelect} onDeleted={handleDeviceDeleted} />
            ))}
          </div>
        )}
      </section>

      {selectedDevice && <TelemetryDashboard device={selectedDevice} history={recentHistory} live={streamState === "connected" && Boolean(selectedDevice.ultimaMetrica)} />}

      <DeviceHistory
        deviceId={selectedDeviceId}
        deviceName={selectedDevice?.nombre ?? null}
        history={history.slice(0, HISTORY_PAGE_SIZE)}
        loading={loadingHistory}
        error={historyError}
        total={historyTotal}
        page={historyPage}
        stale={historyStale}
        newSamples={newSamples}
        onLatest={() => {
          if (selectedDeviceIdRef.current) void requestHistory(selectedDeviceIdRef.current, 1, selectionEpochRef.current)
        }}
        onPageChange={(nextPage) => {
          if (!selectedDeviceIdRef.current || loadingHistory) return
          const maxPage = historyTotal > 0 ? Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE)) : 1
          const target = Math.max(1, Math.min(nextPage, maxPage))
          if (target !== historyPageRef.current) void refreshSelectedHistory(selectedDeviceIdRef.current, target, selectionEpochRef.current)
        }}
        onRetry={() => {
          if (selectedDeviceIdRef.current) void refreshSelectedHistory(selectedDeviceIdRef.current, failedHistoryPage ?? historyPageRef.current, selectionEpochRef.current)
        }}
      />
    </div>
  )
}
