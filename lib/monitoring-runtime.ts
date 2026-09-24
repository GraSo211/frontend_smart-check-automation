import type { Device, DeviceType } from '@/lib/devices-data'
import type { AbiertoPor, Conteos, LoteSector } from '@/lib/production-data'

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

const LOTE_ESTADOS = ['ABIERTO', 'CERRADO'] as const
const DEVICE_TYPES = ['ENTRADA_HORNO', 'SALIDA_HORNO'] as const

// `type` is a free string in the lote contract: the backend emits `""` when the
// device has no functional type, and any value other than ENTRADA_HORNO is a
// degraded lote — never an invalid row.
function isLoteAbiertoPor(value: unknown): value is AbiertoPor {
  return isRecord(value) &&
    typeof value.device_id === 'string' && value.device_id !== '' &&
    typeof value.type === 'string'
}

function isConteos(value: unknown): value is Conteos {
  if (!isRecord(value)) return false
  return (value.ok === null || isFiniteNumber(value.ok)) &&
    (value.crudo === null || isFiniteNumber(value.crudo)) &&
    (value.quemado === null || isFiniteNumber(value.quemado)) &&
    isFiniteNumber(value.total)
}

// Optional contract fields: absent and null are both valid; a present value
// must be well-formed.
function isOptionalIso(value: unknown): boolean {
  return value === undefined || value === null || isValidIso(value)
}

function isLoteSector(value: unknown): value is LoteSector {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || value.id === '') return false
  if (typeof value.sector_id !== 'string' || value.sector_id === '') return false
  if (typeof value.producto_id !== 'string' || value.producto_id === '') return false
  if (typeof value.producto_nombre !== 'string' || value.producto_nombre === '') return false
  if (typeof value.estado !== 'string' || !(LOTE_ESTADOS as readonly string[]).includes(value.estado)) return false
  if (!isValidIso(value.abierto_en)) return false
  if (value.abierto_por !== undefined && value.abierto_por !== null && !isLoteAbiertoPor(value.abierto_por)) return false
  if (!isConteos(value.conteos)) return false
  if (!isOptionalIso(value.ultimo_evento_en)) return false
  if (!isFiniteNumber(value.inactividad_segundos)) return false
  if (!isOptionalIso(value.cerrado_en)) return false
  if (value.motivo_cierre !== undefined && value.motivo_cierre !== null && typeof value.motivo_cierre !== 'string') return false
  if (value.turno !== undefined && value.turno !== null && typeof value.turno !== 'string') return false
  return true
}

/**
 * Non-atomic, per-row lote parser. The envelope must be valid (`success` is
 * absent or `true`, and `data` is an array); a valid array returns only its
 * valid rows, dropping malformed ones and logging them. Returns `null` only
 * when the envelope itself is invalid.
 */
export function parseLoteSectorPayload(payload: unknown): LoteSector[] | null {
  const data = dataFromResponse(payload)
  if (!Array.isArray(data)) return null
  const valid: LoteSector[] = []
  data.forEach((value, index) => {
    if (isLoteSector(value)) {
      valid.push(value)
      return
    }
    const id = isRecord(value) && typeof value.id === 'string' ? value.id : null
    console.warn(
      `[monitoring-runtime] Fila de lote inválida descartada (índice ${index}${id ? `, id ${id}` : ''}).`,
    )
  })
  return valid
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

const AUTH_STATUS_VALUES = ['unenrolled', 'active', 'disabled', 'revoked'] as const

function parseAuthStatus(value: unknown): Device['authStatus'] {
  return typeof value === 'string' && (AUTH_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as Device['authStatus'])
    : undefined
}

// `type` is optional: only the two functional roles are accepted; anything else
// is omitted without invalidating the device.
function parseDeviceType(value: unknown): DeviceType | undefined {
  return typeof value === 'string' && (DEVICE_TYPES as readonly string[]).includes(value)
    ? (value as DeviceType)
    : undefined
}

// `sectorId` is optional: only a non-empty string is accepted.
function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function parseNullableIso(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return isValidIso(value) ? value : undefined
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
  // `whepUrl` is optional: an absent or malformed value must never invalidate
  // the device. A usable camera URL is a non-empty, trimmed string.
  const whepUrl = typeof value.whepUrl === 'string' ? value.whepUrl.trim() : ''
  // Security fields are optional here: legacy device rows and SSE telemetry
  // events may omit them, and an absent field must never reject the device.
  const authStatus = parseAuthStatus(value.authStatus)
  // `hasSecret` is optional: absent means the payload did not carry the field.
  const hasSecret = typeof value.hasSecret === 'boolean' ? value.hasSecret : undefined
  const authUpdatedAt = parseNullableIso(value.authUpdatedAt)
  // `type`/`sectorId` come from the sector grouping; both are optional and a
  // malformed value is omitted rather than rejecting the device.
  const type = parseDeviceType(value.type)
  const sectorId = parseOptionalString(value.sectorId)
  return {
    dispositivoId: value.dispositivoId,
    nombre: typeof value.nombre === 'string' && value.nombre !== '' ? value.nombre : value.dispositivoId,
    ...(whepUrl ? { whepUrl } : {}),
    estado: value.estado,
    ultimaMetrica: metric,
    // An offline node created without telemetry is valid and has no lastSeen yet.
    lastSeen: typeof value.lastSeen === 'string' ? value.lastSeen : '',
    ...(authStatus !== undefined ? { authStatus } : {}),
    ...(hasSecret !== undefined ? { hasSecret } : {}),
    ...(authUpdatedAt !== undefined ? { authUpdatedAt } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(sectorId !== undefined ? { sectorId } : {}),
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
