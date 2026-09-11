import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DeviceHistory } from "@/components/nodos/device-history"
describe("DeviceHistory presentación", () => {
  it("expone actualización accesible y aviso de muestras nuevas", () => {
    const row = { id: "m-1", dispositivoId: "n-1", nombre: "Nodo 1", cpuPct: 1, memRamDisponibleMb: 1, tempChip: 1, aiProcessorPct: 1, receivedAt: "2026-01-01T00:00:00Z" }
    const html = renderToStaticMarkup(React.createElement(DeviceHistory, { deviceId: "n-1", deviceName: "Nodo 1", history: [row], loading: true, total: 120, page: 2, newSamples: 3 }))
    expect(html).toContain("Actualizando historial"); expect(html).toContain("aria-busy=\"true\""); expect(html).toContain("muestras nuevas")
  })
})
