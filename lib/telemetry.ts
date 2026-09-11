import type { Device, SpecificDevice } from "@/lib/devices-data"

export type TelemetryLevel = "normal" | "warning" | "critical" | "unknown"

export function levelFor(value: number | null | undefined, warning: number, critical: number): TelemetryLevel {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown"
  if (value >= critical) return "critical"
  if (value >= warning) return "warning"
  return "normal"
}

export function ramUsedMb(total?: number | null, free?: number | null) {
  if (typeof total !== "number" || !Number.isFinite(total) ||
    typeof free !== "number" || !Number.isFinite(free) || total <= 0) return undefined
  return Math.max(0, total - free)
}

export function percent(value: number | null | undefined, total?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) ||
    typeof total !== "number" || !Number.isFinite(total) || total <= 0) return undefined
  return Math.min(100, Math.max(0, (value / total) * 100))
}

export function formatSnapshot(value: number | undefined, suffix = "%") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${suffix}`
    : "—"
}

export type TelemetrySample = { dispositivoId: string; receivedAt: string; id?: string | null }

/** Deduplicates by device/report id, falling back to device/report time. */
export function mergeTelemetrySamples<T extends TelemetrySample>(...groups: T[][]): T[] {
  const unique = new Map<string, T>()
  for (const group of groups) for (const sample of group) {
    const key = sample.id ? `${sample.dispositivoId}|id:${sample.id}` : `${sample.dispositivoId}|at:${sample.receivedAt}`
    unique.set(key, sample)
  }
  return [...unique.values()].map((sample, index) => ({ sample, index })).sort((a, b) => {
    const aTime = Date.parse(a.sample.receivedAt)
    const bTime = Date.parse(b.sample.receivedAt)
    const aValid = Number.isFinite(aTime)
    const bValid = Number.isFinite(bTime)
    if (aValid && bValid && aTime !== bTime) return bTime - aTime
    if (aValid !== bValid) return aValid ? -1 : 1
    return a.index - b.index
  }).map(({ sample }) => sample)
}

/** Keeps incoming live samples when a slower history request resolves. */
export function mergeIncomingTelemetrySamples<T extends TelemetrySample>(
  existing: T[],
  incoming: T[],
  cap?: number,
): T[] {
  const merged = mergeTelemetrySamples(existing, incoming)
  return typeof cap === "number" ? merged.slice(0, cap) : merged
}

export function samplesForDevice<T extends TelemetrySample>(samples: T[], dispositivoId: string): T[] {
  return samples.filter((sample) => sample.dispositivoId === dispositivoId)
}

/**
 * Builds the chart series in chronological order. The current metric is last
 * in the merge so a corrected live value wins over a history row at the same
 * timestamp; capping happens while newest-first, before reversing for charts.
 */
export function buildDashboardSamples(
  device: Device,
  history: SpecificDevice[],
  cap = 24,
): SpecificDevice[] {
  const current = device.ultimaMetrica
    ? [{ ...device.ultimaMetrica, nombre: device.nombre }]
    : []
  const merged = mergeTelemetrySamples(samplesForDevice(history, device.dispositivoId), current)
  return merged.slice(0, cap).reverse()
}

/** State-only SSE updates must not erase the last known telemetry. */
export function mergeDeviceUpdate(current: Device, incoming: Device): Device {
  return {
    ...current,
    ...incoming,
    ultimaMetrica: incoming.ultimaMetrica ?? current.ultimaMetrica,
  }
}

function newestMetric(current: Device["ultimaMetrica"], incoming: Device["ultimaMetrica"]) {
  if (!current) return incoming
  if (!incoming) return current

  const currentAt = Date.parse(current.receivedAt)
  const incomingAt = Date.parse(incoming.receivedAt)
  if (!Number.isFinite(currentAt)) return incoming
  if (!Number.isFinite(incomingAt) || currentAt >= incomingAt) return current
  return incoming
}

/** Reconciles a snapshot without allowing an older metric to roll state back. */
export function reconcileDeviceSnapshot(current: Device[], snapshot: Device[]): Device[] {
  const currentById = new Map(current.map((device) => [device.dispositivoId, device]))
  return snapshot.map((incoming) => {
    const existing = currentById.get(incoming.dispositivoId)
    if (!existing) return incoming
    return {
      ...existing,
      ...incoming,
      ultimaMetrica: newestMetric(existing.ultimaMetrica, incoming.ultimaMetrica),
    }
  })
}
