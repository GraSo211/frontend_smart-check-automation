import type { Device, DeviceType } from '@/lib/devices-data'
import type { AbiertoPor, Conteos, LoteSector } from '@/lib/production-data'
import { isRecord } from '@/lib/is-record'

export function isValidIso(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || value === null || isFiniteNumber(value)
}

function dataFromResponse(payload: unknown): unknown {
  if (!isRecord(payload)) return payload
  if ('success' in payload && payload.success !== true) return null
  return 'data' in payload ? payload.data : payload
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
  if (!isOptionalFiniteNumber(value.delta_temp1_max_c)) return false
  if (!isOptionalFiniteNumber(value.delta_vel_max)) return false
  return true
}

function parseOptionalNumberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return isFiniteNumber(value) ? value : null
}

// 0..1 or null. Missing/out-of-range/non-numeric degrades to null (legacy
// closed lots predate the column) instead of rejecting the row.
function parseConfianzaPromedio(value: unknown): number | null {
  return isFiniteNumber(value) && value >= 0 && value <= 1 ? value : null
}

/**
 * Normaliza los campos opcionales de un lote que el backend puede enviar con
 * tipos incorrectos. Un valor inválido se convierte en `null` (equivale a "usar
 * el valor del producto" para los deltas), nunca rechaza la fila.
 */
function normalizeLoteSector(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...value,
    delta_temp1_max_c: parseOptionalNumberOrNull(value.delta_temp1_max_c),
    delta_vel_max: parseOptionalNumberOrNull(value.delta_vel_max),
    confianza_promedio: parseConfianzaPromedio(value.confianza_promedio),
  }
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
    const normalized = normalizeLoteSector(value)
    if (isLoteSector(normalized)) {
      valid.push(normalized)
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
  // `whepUrl` ya no se usa en el front: el backend puede seguir enviándolo,
  // pero la URL WHEP se deriva localmente a partir del nombre y el tipo.
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
