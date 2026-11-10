// Colores y helpers de formato del PDF operativo. Módulo puro: sin React ni
// acceso a red, para poder testear escalas y formatos por separado.
import { APP_TIME_ZONE } from "@/lib/format"

export const palette = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  soft: "#f8fafc",
  primary: "#0d9488",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
} as const

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function artParts(value: string): Intl.DateTimeFormatPart[] | null {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? ""
}

/** dd/mm/aaaa. Las fechas `YYYY-MM-DD` no se reinterpretan con zona horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const match = DATE_ONLY.exec(value)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  const parts = artParts(value)
  if (!parts) return value
  return `${part(parts, "day")}/${part(parts, "month")}/${part(parts, "year")}`
}

/** dd/mm/aaaa hh:mm en ART. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  return `${part(parts, "day")}/${part(parts, "month")}/${part(parts, "year")} ${part(parts, "hour")}:${part(parts, "minute")}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 })
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return `${value.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

/** La confianza del modelo viaja en 0..1; las tasas ya vienen en 0..100. */
export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return formatPercent(value * 100)
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`
}

export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return `${Math.round(value).toLocaleString("es-AR")} min`
}

/** Los cortes por turno llegan con nombre vacío y la clave es el turno. */
export function formatGrupoLabel(row: { clave: string; nombre: string }): string {
  if (row.nombre) return row.nombre
  if (!row.clave) return "—"
  return row.clave.charAt(0).toUpperCase() + row.clave.slice(1)
}

/** Escala lineal clampeada a `[0, size]`; rango vacío devuelve el centro. */
export function scaleLinear(value: number, min: number, max: number, size: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || size <= 0) {
    return 0
  }
  if (max <= min) return size / 2
  const ratio = (value - min) / (max - min)
  return Math.max(0, Math.min(1, ratio)) * size
}
