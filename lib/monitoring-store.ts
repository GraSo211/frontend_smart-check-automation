import type { MonitoringView, NodeObservation, ServiceStatus, SourceSync } from '@/lib/monitoring-types'

export const MONITORING_TTL_MS = 75_000
export const CAMERA_TTL_MS = 10_000

export type MonitoringState = {
  backend: ServiceStatus
  nodes: ServiceStatus & { online: number; offline: number; unknown: number }
  /** Per-device evidence is intentionally separate from the fleet snapshot. */
  nodeObservations?: Record<string, NodeObservation>
  inventoryObservedAt?: string | null
  camera: ServiceStatus
  sync: { lotes: SourceSync; nodos: SourceSync }
}

export function unknownStatus(detail = 'Sin observación todavía.'): ServiceStatus {
  return { availability: 'unknown', checkedAt: null, detail }
}

export function emptySourceSync(): SourceSync {
  return {
    lastQueryAt: null,
    lastDataEventAt: null,
    lastConfirmedAt: null,
    freshness: 'never',
  }
}

export function createInitialMonitoringState(): MonitoringState {
  return {
    backend: unknownStatus(),
    nodes: { ...unknownStatus(), online: 0, offline: 0, unknown: 0 },
    camera: unknownStatus(),
    sync: { lotes: emptySourceSync(), nodos: emptySourceSync() },
  }
}

function validIso(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value))
}

function newerIso(current: string | null, next: string): string {
  if (!validIso(current) || Date.parse(next) > Date.parse(current)) return next
  return current
}

function withFreshness(sync: SourceSync, now: number): SourceSync {
  if (!sync.lastConfirmedAt) return { ...sync, freshness: 'never' }
  const confirmedAt = Date.parse(sync.lastConfirmedAt)
  return {
    ...sync,
    freshness: Number.isFinite(confirmedAt) && now - confirmedAt <= MONITORING_TTL_MS ? 'fresh' : 'stale',
  }
}

export function confirmQuery(sync: SourceSync, at: string): SourceSync {
  if (!validIso(at)) return sync
  const lastQueryAt = newerIso(sync.lastQueryAt, at)
  return {
    ...sync,
    lastQueryAt,
    lastConfirmedAt: newerIso(sync.lastConfirmedAt, at),
  }
}

export function confirmDataEvent(sync: SourceSync, at: string): SourceSync {
  if (!validIso(at)) return sync
  const lastDataEventAt = newerIso(sync.lastDataEventAt, at)
  return {
    ...sync,
    lastDataEventAt,
    lastConfirmedAt: newerIso(sync.lastConfirmedAt, at),
  }
}

function freshStatus(status: ServiceStatus, now: number, ttl = MONITORING_TTL_MS): ServiceStatus {
  if (!status.checkedAt) return status
  const checkedAt = Date.parse(status.checkedAt)
  if (!Number.isFinite(checkedAt)) {
    return {
      availability: 'unknown',
      checkedAt: null,
      detail: 'La observación tiene una fecha inválida.',
    }
  }
  if (now - checkedAt <= ttl) return status
  return {
    availability: 'unknown',
    checkedAt: status.checkedAt,
    detail: 'La evidencia de disponibilidad está vencida.',
  }
}

export function nodeStatusFromObservations(
  observations: Record<string, NodeObservation> | undefined,
  inventoryObservedAt: string | null | undefined,
  now: number,
): ServiceStatus & { online: number; offline: number; unknown: number; inventoryObservedAt: string | null } {
  const entries = Object.values(observations ?? {})
  let online = 0
  let offline = 0
  let unknown = 0

  for (const observation of entries) {
    const observedAt = Date.parse(observation.observedAt)
    if (!Number.isFinite(observedAt) || now - observedAt > MONITORING_TTL_MS) {
      unknown += 1
    } else if (observation.device.estado === 'online') {
      online += 1
    } else {
      offline += 1
    }
  }

  const inventoryAt = inventoryObservedAt && Number.isFinite(Date.parse(inventoryObservedAt))
    ? inventoryObservedAt
    : null
  const inventoryFresh = inventoryAt !== null && now - Date.parse(inventoryAt) <= MONITORING_TTL_MS
  const total = online + offline + unknown
  let availability: MonitoringView['nodes']['availability'] = 'unknown'
  if (total > 0 && inventoryFresh && unknown === 0) {
    availability = online === total ? 'available' : offline === total ? 'disconnected' : 'degraded'
  } else if (total > 0 && inventoryFresh) {
    availability = 'degraded'
  }

  const detail = total === 0
    ? 'La flota no tiene nodos registrados.'
    : !inventoryFresh
      ? 'La observación del inventario de nodos está vencida.'
      : availability === 'available'
        ? `${online} nodos online.`
        : availability === 'disconnected'
          ? `${offline} nodos offline.`
          : 'La flota tiene estados mixtos o incompletos.'

  return { availability, checkedAt: inventoryAt, detail, online, offline, unknown, inventoryObservedAt: inventoryAt }
}

function overallStatus(
  backend: ServiceStatus,
  nodes: ServiceStatus,
  camera: ServiceStatus,
  transportDegraded: boolean,
): ServiceStatus {
  const statuses = [backend, nodes, camera]
  const checkedAt = statuses
    .map((status) => status.checkedAt)
    .filter((value): value is string => value !== null)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null

  if (backend.availability === 'disconnected' && nodes.availability !== 'available' && camera.availability !== 'available') {
    return { availability: 'disconnected', checkedAt, detail: 'El backend no está disponible para el panel.' }
  }
  if (statuses.every((status) => status.availability === 'available') && !transportDegraded) {
    return { availability: 'available', checkedAt, detail: 'Backend, nodos y cámara disponibles.' }
  }
  // Confirmed failures take precedence over an unobserved camera. A missing
  // camera observation must not hide a backend or fleet failure.
  if (statuses.some((status) => status.availability === 'disconnected' || status.availability === 'degraded') || transportDegraded) {
    if (backend.availability === 'disconnected' && camera.availability === 'available') {
      return { availability: 'degraded', checkedAt, detail: 'La cámara está disponible, pero el backend no responde.' }
    }
    return {
      availability: 'degraded',
      checkedAt,
      detail: 'Hay una fuente o transporte con disponibilidad parcial.',
    }
  }
  if (camera.availability === 'unknown') {
    return {
      availability: 'unknown',
      checkedAt,
      detail: 'La cámara todavía no tiene una observación vigente.',
    }
  }
  return { availability: 'unknown', checkedAt, detail: 'Falta una observación vigente de algún servicio.' }
}

export function toMonitoringView(
  state: MonitoringState,
  now = Date.now(),
  transportDegraded = false,
): MonitoringView {
  const backend = freshStatus(state.backend, now)
  const nodes = state.nodeObservations
    ? nodeStatusFromObservations(state.nodeObservations, state.inventoryObservedAt, now)
    : {
      ...freshStatus(state.nodes, now),
      online: state.nodes.online,
      offline: state.nodes.offline,
      unknown: state.nodes.unknown,
      inventoryObservedAt: null,
    }
  const camera = freshStatus(state.camera, now, CAMERA_TTL_MS)
  return {
    backend,
    nodes,
    camera,
    overall: overallStatus(backend, nodes, camera, transportDegraded),
    sync: {
      lotes: withFreshness(state.sync.lotes, now),
      nodos: withFreshness(state.sync.nodos, now),
    },
  }
}
