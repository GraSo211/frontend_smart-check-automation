export type Availability = 'available' | 'degraded' | 'disconnected' | 'unknown'

export type ServiceStatus = {
  availability: Availability
  checkedAt: string | null
  detail: string
}

export type NodeObservation = {
  device: import('@/lib/devices-data').Device
  observedAt: string
}

export type SourceSync = {
  lastQueryAt: string | null
  lastDataEventAt: string | null
  lastConfirmedAt: string | null
  freshness: 'fresh' | 'stale' | 'never'
}

export type MonitoringView = {
  backend: ServiceStatus
  nodes: ServiceStatus & {
    online: number
    offline: number
    unknown: number
    inventoryObservedAt: string | null
  }
  camera: ServiceStatus
  overall: ServiceStatus
  sync: {
    lotes: SourceSync
    nodos: SourceSync
  }
}
