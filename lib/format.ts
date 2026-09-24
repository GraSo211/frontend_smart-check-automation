// Formatting helpers shared across dashboard components.

// Display time zone for every user-facing date/time in the app.
export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires"

// Formats a number with thousands separators (e.g. 1200 -> "1,200").
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value)
}

// Formats an ISO date into a short readable date in Buenos Aires time (e.g. "Jun 02").
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    month: "short",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  })
}

// Formats an ISO date into HH:mm Buenos Aires time (e.g. "03:00").
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  })
}

// Builds a compact time window string (e.g. "Jun 02 · 03:00–05:30").
export function formatWindow(start: string, end: string): string {
  return `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)}`
}

// Returns a quality rate percentage given correct vs total units.
// A `null` bucket means "not produced" and counts as 0; a zero total keeps
// returning 0 for backward compatibility.
export function qualityRate(correctos: number | null, total: number): number {
  if (total === 0) return 0
  return ((correctos ?? 0) / total) * 100
}

// Renders a counter bucket that may be absent. A `null` bucket means the state
// was not produced, so it is shown as "—" instead of a misleading 0.
export function formatBucket(value: number | null): string {
  return value === null ? "—" : formatNumber(value)
}

// Formats a chip temperature with one decimal and the °C unit (e.g. "46,8 °C").
export function formatTemp(value: number): string {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} °C`
}

// Formats available RAM, switching to GB once >= 1024 MB (e.g. "3,04 GB" / "900 MB").
export function formatRam(megabytes: number): string {
  if (megabytes >= 1024) {
    return `${(megabytes / 1024).toLocaleString("es-AR", { maximumFractionDigits: 2 })} GB`
  }
  return `${formatNumber(Math.round(megabytes))} MB`
}

// Returns a relative "time ago" label in es-AR (e.g. "hace 5 min", "hace 3 h").
export function formatLastSeen(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(elapsedMs / 60000)
  if (minutes < 1) return "hace momentos"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}
