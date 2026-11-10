import { APP_TIME_ZONE } from "@/lib/format"
import type {
  TrazabilidadDataset,
  TrazabilidadDelimiter,
} from "@/lib/reportes-trazabilidad-csv"

export type AppliedFilters = {
  desde: string
  hasta: string
  sectorId: string
  productoId: string
  turno: string
}

export type TurnoOption = { value: string; label: string }

export const TURNOS: TurnoOption[] = [
  { value: "mañana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "noche", label: "Noche" },
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RANGE_DAYS = 366

function todayInArt(): Date {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  const year = Number(get("year"))
  const month = Number(get("month"))
  const day = Number(get("day"))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export function formatArtDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function getDefaultReporteDateRange(): { desde: string; hasta: string } {
  const hasta = todayInArt()
  const desde = new Date(hasta)
  // 30 días inclusivos: hoy + los 29 anteriores.
  desde.setDate(hasta.getDate() - 29)
  return { desde: formatArtDate(desde), hasta: formatArtDate(hasta) }
}

function firstString(value: string | string[] | undefined): string {
  if (value === undefined) return ""
  return Array.isArray(value) ? value[0] ?? "" : value
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidRange(desde: string, hasta: string): boolean {
  if (desde > hasta) return false
  const days =
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) /
      86_400_000 +
    1
  return days <= MAX_RANGE_DAYS
}

export function parseReporteSearchParams(
  raw: Record<string, string | string[] | undefined>,
): AppliedFilters {
  const defaults = getDefaultReporteDateRange()
  const rawDesde = firstString(raw.desde)
  const rawHasta = firstString(raw.hasta)
  const validDates =
    isValidDate(rawDesde) &&
    isValidDate(rawHasta) &&
    isValidRange(rawDesde, rawHasta)

  const rawProducto = firstString(raw.producto_id)
  const rawTurno = firstString(raw.turno)

  return {
    desde: validDates ? rawDesde : defaults.desde,
    hasta: validDates ? rawHasta : defaults.hasta,
    sectorId: firstString(raw.sector_id),
    productoId: UUID_RE.test(rawProducto) ? rawProducto : "",
    turno: TURNOS.some((t) => t.value === rawTurno) ? rawTurno : "",
  }
}

export function buildReportesQuery(filters: AppliedFilters): string {
  const params = new URLSearchParams()
  params.set("desde", filters.desde)
  params.set("hasta", filters.hasta)
  if (filters.sectorId) params.set("sector_id", filters.sectorId)
  if (filters.productoId) params.set("producto_id", filters.productoId)
  if (filters.turno) params.set("turno", filters.turno)
  return params.toString()
}

export function buildDownloadHref(
  filters: AppliedFilters,
  format: "csv" | "json" | "pdf",
  delimiter?: "," | ";",
): string {
  const params = new URLSearchParams(buildReportesQuery(filters))
  params.set("format", format)
  if (format === "csv" && delimiter) {
    params.set("delim", delimiter)
  }
  return `/api/reportes/lotes?${params.toString()}`
}

/** Descarga CSV/JSON de las alertas del período. */
export function buildAlertasDownloadHref(
  filters: AppliedFilters,
  format: "csv" | "json" = "csv",
  delimiter?: "," | ";",
): string {
  const params = new URLSearchParams(buildReportesQuery(filters))
  params.set("format", format)
  if (format === "csv" && delimiter) {
    params.set("delim", delimiter)
  }
  return `/api/reportes/alertas?${params.toString()}`
}

/** UUID canónico (cualquier versión, case-insensitive) como el que exige el backend. */
export function isLoteUUID(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Descarga del PDF de trazabilidad de un lote. */
export function buildTrazabilidadDownloadHref(loteId: string): string {
  const params = new URLSearchParams()
  params.set("lote_id", loteId.trim())
  params.set("format", "pdf")
  return `/api/reportes/trazabilidad?${params.toString()}`
}

/** Descarga CSV de un dataset de trazabilidad de un lote. */
export function buildTrazabilidadCsvHref(
  loteId: string,
  dataset: TrazabilidadDataset,
  delimiter?: TrazabilidadDelimiter,
): string {
  const params = new URLSearchParams()
  params.set("lote_id", loteId.trim())
  params.set("format", "csv")
  params.set("dataset", dataset)
  if (delimiter) params.set("delim", delimiter)
  return `/api/reportes/trazabilidad?${params.toString()}`
}

function oneDecimal(value: number): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${oneDecimal(value)}%`
}

// La confianza del modelo viaja en 0..1; las tasas ya vienen en 0..100.
export function formatConfidence(value: number | null): string {
  return value === null ? "—" : `${oneDecimal(value * 100)}%`
}

export function formatGrupoLabel(row: { clave: string; nombre: string }): string {
  if (row.nombre) return row.nombre
  if (!row.clave) return "—"
  return row.clave.charAt(0).toUpperCase() + row.clave.slice(1)
}

export function formatKg(value: number | null): string {
  return value === null
    ? "—"
    : `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`
}

export function formatMinutes(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} min`
}

export function formatUnits(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("es-AR")
}
