// Formatting helpers shared across dashboard components.

// Formats a number with thousands separators (e.g. 1200 -> "1,200").
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

// Formats a kilogram value with one decimal (e.g. 220.5 -> "220.5 kg").
export function formatKg(value: number): string {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
}

// Formats an ISO date into a short readable date (e.g. "Jun 02").
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })
}

// Formats an ISO date into HH:mm time (e.g. "06:00").
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
}

// Builds a compact time window string (e.g. "Jun 02 · 06:00–08:30").
export function formatWindow(start: string, end: string): string {
  return `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)}`
}

// Returns a quality rate percentage given correct vs total units.
export function qualityRate(correctos: number, total: number): number {
  if (total === 0) return 0
  return (correctos / total) * 100
}
