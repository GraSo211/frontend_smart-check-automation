import type { Device } from '@/lib/devices-data'
import type { ProductionRun } from '@/lib/production-data'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isValidIso(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function dataFromResponse(payload: unknown, allowDirect = true): unknown {
  if (!isRecord(payload)) return allowDirect ? payload : null
  if ('success' in payload && payload.success !== true) return null
  return 'data' in payload ? payload.data : allowDirect ? payload : null
}

function isProductionRun(value: unknown): value is ProductionRun {
  if (!isRecord(value)) return false
  const stringFields = ['id', 'productoId', 'productoNombre']
  const dateFields = ['inicioAt', 'finAt', 'createdAt', 'updatedAt']
  const numericFields = [
    'totalUnidades', 'correctos', 'quemados', 'correctosKg', 'quemadosKg',
    'tempHorno1', 'tempCombHorno1', 'tempHorno2', 'tempCombHorno2', 'velocidadCinta',
  ]
  return stringFields.every((field) => typeof value[field] === 'string' && value[field] !== '') &&
    dateFields.every((field) => isValidIso(value[field])) &&
    (value.turno === 'mañana' || value.turno === 'tarde' || value.turno === 'noche') &&
    numericFields.every((field) => isFiniteNumber(value[field])) &&
    (value.crudas === null || isFiniteNumber(value.crudas)) &&
    (value.crudosKg === null || isFiniteNumber(value.crudosKg))
}

export function parseProductionPayload(payload: unknown): ProductionRun[] | null {
  const data = dataFromResponse(payload)
  return Array.isArray(data) && data.every(isProductionRun) ? data : null
}

function parseMetric(value: unknown, dispositivoId: string): Device['ultimaMetrica'] | undefined | null {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const required = ['cpuPct', 'memRamDisponibleMb', 'tempChip', 'aiProcessorPct']
  if (!required.every((field) => isFiniteNumber(value[field]))) return null
  const optionalNumbers = ['memRamTotalMb', 'almacenamientoDisponibleMb', 'almacenamientoTotalMb']
  if (optionalNumbers.some((field) => value[field] !== undefined && !isFiniteNumber(value[field]))) return null
  if (!isValidIso(value.receivedAt)) return null
  return {
    id: value.id,
    dispositivoId: typeof value.dispositivoId === 'string' ? value.dispositivoId : dispositivoId,
    cpuPct: value.cpuPct as number,
    memRamDisponibleMb: value.memRamDisponibleMb as number,
    memRamTotalMb: value.memRamTotalMb === undefined ? undefined : isFiniteNumber(value.memRamTotalMb) ? value.memRamTotalMb : undefined,
    almacenamientoDisponibleMb: value.almacenamientoDisponibleMb === undefined ? undefined : isFiniteNumber(value.almacenamientoDisponibleMb) ? value.almacenamientoDisponibleMb : undefined,
    almacenamientoTotalMb: value.almacenamientoTotalMb === undefined ? undefined : isFiniteNumber(value.almacenamientoTotalMb) ? value.almacenamientoTotalMb : undefined,
    tempChip: value.tempChip as number,
    aiProcessorPct: value.aiProcessorPct as number,
    receivedAt: value.receivedAt,
  }
}

export function parseDevice(value: unknown): Device | null {
  if (!isRecord(value) || typeof value.dispositivoId !== 'string' || value.dispositivoId === '') return null
  if (value.estado !== 'online' && value.estado !== 'offline') return null
  const metric = parseMetric(value.ultimaMetrica, value.dispositivoId)
  if (metric === null) return null
  const hasLastSeen = typeof value.lastSeen === 'string' && value.lastSeen !== ''
  const hasOfflineEmptyLastSeen = value.estado === 'offline' && metric === undefined &&
    (value.lastSeen === undefined || value.lastSeen === '')
  if (!hasLastSeen && !hasOfflineEmptyLastSeen) return null
  if (hasLastSeen && !isValidIso(value.lastSeen)) return null
  return {
    dispositivoId: value.dispositivoId,
    nombre: typeof value.nombre === 'string' && value.nombre !== '' ? value.nombre : value.dispositivoId,
    ubicacion: typeof value.ubicacion === 'string' ? value.ubicacion : '—',
    estado: value.estado,
    ultimaMetrica: metric,
    // An offline node created without telemetry is valid and has no lastSeen yet.
    lastSeen: typeof value.lastSeen === 'string' ? value.lastSeen : '',
  }
}

export function parseDeviceEventPayload(payload: unknown): Device | null {
  if (!isRecord(payload)) return parseDevice(payload)
  if ('success' in payload && payload.success !== true) return null
  return parseDevice('data' in payload ? payload.data : payload)
}

export function parseDevicesPayload(payload: unknown): Device[] | null {
  const data = dataFromResponse(payload)
  // A snapshot is atomic: one malformed row invalidates the whole observation.
  return Array.isArray(data) && data.every((value) => parseDevice(value) !== null)
    ? data.map((value) => parseDevice(value) as Device)
    : null
}
