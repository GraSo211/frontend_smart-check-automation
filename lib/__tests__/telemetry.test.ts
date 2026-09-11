import { describe, expect, it } from "vitest"
import type { Device, SpecificDevice } from "@/lib/devices-data"
import {
  buildDashboardSamples,
  levelFor,
  mergeDeviceUpdate,
  mergeIncomingTelemetrySamples,
  mergeTelemetrySamples,
  percent,
  ramUsedMb,
  reconcileDeviceSnapshot,
} from "@/lib/telemetry"

function sample(dispositivoId: string, receivedAt: string, cpuPct: number): SpecificDevice {
  return {
    id: `${dispositivoId}-${receivedAt}`,
    dispositivoId,
    nombre: dispositivoId,
    cpuPct,
    memRamDisponibleMb: 1000,
    memRamTotalMb: 2000,
    almacenamientoDisponibleMb: 3000,
    almacenamientoTotalMb: 4000,
    tempChip: 40,
    aiProcessorPct: 20,
    receivedAt,
  }
}

function device(dispositivoId: string, receivedAt: string, cpuPct: number): Device {
  const metric = sample(dispositivoId, receivedAt, cpuPct)
  return {
    dispositivoId,
    nombre: dispositivoId,
    ubicacion: "Planta",
    estado: "online",
    ultimaMetrica: metric,
    lastSeen: receivedAt,
  }
}

describe("telemetry thresholds and fallbacks", () => {
  it("classifies values at warning and critical boundaries", () => {
    expect(levelFor(0, 70, 80)).toBe("normal")
    expect(levelFor(69.9, 70, 80)).toBe("normal")
    expect(levelFor(70, 70, 80)).toBe("warning")
    expect(levelFor(80, 70, 80)).toBe("critical")
  })

  it("derives memory usage only when the expanded total is available", () => {
    expect(ramUsedMb(4096, 1024)).toBe(3072)
    expect(ramUsedMb(undefined, 1024)).toBeUndefined()
    expect(percent(3072, 4096)).toBe(75)
    expect(percent(10, undefined)).toBeUndefined()
    expect(levelFor(undefined, 70, 80)).toBe("unknown")
    expect(levelFor(Number.NaN, 70, 80)).toBe("unknown")
    expect(ramUsedMb(Number.NaN, 1024)).toBeUndefined()
    expect(percent(Number.NaN, 4096)).toBeUndefined()
    expect(percent(10, Number.NaN)).toBeUndefined()
  })

  it("deduplicates by device and report time while retaining live samples", () => {
    const history = [{ dispositivoId: "n1", receivedAt: "2026-01-01T00:00:00.000Z", value: 1 }]
    const live = [{ dispositivoId: "n1", receivedAt: "2026-01-01T00:00:00.000Z", value: 2 }, { dispositivoId: "n1", receivedAt: "2026-01-01T00:01:00.000Z", value: 3 }]
    expect(mergeTelemetrySamples(history, live)).toEqual([live[1], live[0]])
  })

  it("uses the current metric for a duplicate latest sample and keeps the prior distinct sample", () => {
    const current = device("n1", "2026-01-01T00:01:00.000Z", 30)
    const rows = [
      sample("n1", "2026-01-01T00:00:00.000Z", 10),
      sample("n1", "2026-01-01T00:01:00.000Z", 20),
    ]

    const samples = buildDashboardSamples(current, rows)

    expect(samples.map((row) => row.cpuPct)).toEqual([10, 30])
    expect(samples.at(-2)?.cpuPct).toBe(10)
  })

  it("lets a corrected SSE sample win at the same timestamp", () => {
    const existing = sample("n1", "2026-01-01T00:01:00.000Z", 20)
    const corrected = sample("n1", "2026-01-01T00:01:00.000Z", 30)

    expect(mergeIncomingTelemetrySamples([existing], [corrected])).toEqual([corrected])
  })

  it("deduplicates by id while retaining distinct ids at the same timestamp", () => {
    const first = { ...sample("n1", "2026-01-01T00:01:00.000Z", 20), id: "metric-1" }
    const corrected = { ...first, cpuPct: 30 }
    const distinct = { ...first, id: "metric-2", cpuPct: 40 }

    expect(mergeTelemetrySamples([first], [corrected, distinct])).toEqual([corrected, distinct])
  })

  it("does not let a stale snapshot replace the current metric", () => {
    const current = device("n1", "2026-01-01T00:02:00.000Z", 30)
    const stale = device("n1", "2026-01-01T00:01:00.000Z", 10)

    expect(reconcileDeviceSnapshot([current], [stale])[0].ultimaMetrica?.cpuPct).toBe(30)
  })

  it("isolates dashboard history when selection changes from A to B", () => {
    const history = [
      sample("n-a", "2026-01-01T00:00:00.000Z", 10),
      sample("n-b", "2026-01-01T00:00:00.000Z", 20),
    ]

    const samples = buildDashboardSamples(device("n-b", "2026-01-01T00:01:00.000Z", 30), history)

    expect(samples.every((row) => row.dispositivoId === "n-b")).toBe(true)
    expect(samples.map((row) => row.cpuPct)).toEqual([20, 30])
  })

  it("preserves telemetry for a state-only update", () => {
    const current = device("n1", "2026-01-01T00:01:00.000Z", 30)
    const stateOnly = { ...current, estado: "offline" as const, ultimaMetrica: undefined }

    expect(mergeDeviceUpdate(current, stateOnly).ultimaMetrica?.cpuPct).toBe(30)
  })
})
