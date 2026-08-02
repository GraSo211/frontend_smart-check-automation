import { describe, it, expect } from "vitest"
import { DEVICES, getDeviceHistoryPage } from "@/lib/devices-data"

describe("DEVICES", () => {
  it("contains at least one device", () => {
    expect(DEVICES.length).toBeGreaterThan(0)
  })

  it("has unique, non-empty ids", () => {
    const ids = DEVICES.map((d) => d.dispositivoId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0)
    }
  })

  it("every device has required fields", () => {
    for (const device of DEVICES) {
      expect(device.nombre).toBeTruthy()
      expect(device.ubicacion).toBeTruthy()
      expect(["online", "offline"]).toContain(device.estado)
      expect(device.ultimaMetrica.dispositivoId).toBe(device.dispositivoId)
      expect(device.ultimaMetrica.cpuPct).toBeGreaterThanOrEqual(0)
      expect(device.ultimaMetrica.memRamDisponibleMb).toBeGreaterThan(0)
      expect(device.ultimaMetrica.tempChip).toBeGreaterThan(0)
      expect(new Date(device.ultimaMetrica.receivedAt).getTime()).not.toBeNaN()
      expect(device.lastSeen).toBeTruthy()
    }
  })

  it("exercises both online and offline states", () => {
    expect(DEVICES.some((d) => d.estado === "online")).toBe(true)
    expect(DEVICES.some((d) => d.estado === "offline")).toBe(true)
  })
})

describe("getDeviceHistoryPage", () => {
  const id = DEVICES[0].dispositivoId

  it("returns first page of items", () => {
    const page = getDeviceHistoryPage(id, 1, 10)
    expect(page.success).toBe(true)
    expect(page.data.length).toBeGreaterThan(0)
    expect(page.page).toBe(1)
    expect(page.pageSize).toBe(10)
    expect(page.total).toBeGreaterThan(page.data.length)
    for (const row of page.data) {
      expect(row.dispositivoId).toBe(id)
      expect(new Date(row.receivedAt).getTime()).not.toBeNaN()
    }
  })

  it("returns empty page beyond total", () => {
    const page = getDeviceHistoryPage(id, 999, 10)
    expect(page.data).toHaveLength(0)
  })

  it("is deterministic for the same device", () => {
    const a = getDeviceHistoryPage(id, 1, 10).data
    const b = getDeviceHistoryPage(id, 1, 10).data
    expect(a).toEqual(b)
  })
})
