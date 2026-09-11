import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TelemetryDashboard } from "@/components/nodos/telemetry-dashboard"
import type { Device } from "@/lib/devices-data"
const device = (ultimaMetrica?: Device["ultimaMetrica"]) => ({ dispositivoId: "n-1", nombre: "Nodo 1", ubicacion: "Planta", estado: "online", ultimaMetrica, lastSeen: "2026-01-01T00:00:00Z" } as Device)
describe("TelemetryDashboard diagnóstico", () => {
  it("no inventa ceros ni rompe con métrica ausente", () => { const html = renderToStaticMarkup(React.createElement(TelemetryDashboard, { device: device(), history: [] })); expect(html).toContain("Sin datos"); expect(html).not.toContain("NaN") })
  it("conserva el cero real", () => { const metric = { id: "m-1", dispositivoId: "n-1", cpuPct: 0, aiProcessorPct: 0, tempChip: 0, memRamDisponibleMb: 0, receivedAt: "2026-01-01T00:00:00Z" } as Device["ultimaMetrica"]; expect(renderToStaticMarkup(React.createElement(TelemetryDashboard, { device: device(metric), history: [] }))).toContain("0%") })

  it("trata null, undefined y NaN como ausentes en cada métrica", () => {
    const values = [null, undefined, Number.NaN]
    for (const value of values) {
      const metric = {
        id: "m-current",
        dispositivoId: "n-1",
        cpuPct: value,
        aiProcessorPct: value,
        tempChip: value,
        memRamDisponibleMb: value,
        memRamTotalMb: 1024,
        almacenamientoDisponibleMb: 100,
        almacenamientoTotalMb: 1000,
        receivedAt: "2026-01-01T00:00:00Z",
      } as unknown as Device["ultimaMetrica"]
      const html = renderToStaticMarkup(React.createElement(TelemetryDashboard, {
        device: device(metric),
        history: [{ ...metric, id: "m-previous", cpuPct: Number.NaN, aiProcessorPct: undefined, tempChip: null, memRamDisponibleMb: undefined } as unknown as never],
      }))
      expect(html).not.toContain("NaN")
      expect(html).toContain("Sin datos")
    }
  })

  it("rechaza almacenamiento disponible mayor que la capacidad", () => {
    const metric = { id: "m-1", dispositivoId: "n-1", cpuPct: 1, aiProcessorPct: 1, tempChip: 1, memRamDisponibleMb: 1, almacenamientoDisponibleMb: 2, almacenamientoTotalMb: 1, receivedAt: "2026-01-01T00:00:00Z" } as Device["ultimaMetrica"]
    const html = renderToStaticMarkup(React.createElement(TelemetryDashboard, { device: device(metric), history: [] }))
    expect(html).toContain("Almacenamiento no disponible")
    expect(html).not.toContain("-1 MB usados")
  })
})
