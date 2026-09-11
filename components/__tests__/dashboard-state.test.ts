import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const monitoringMocks = vi.hoisted(() => ({
  useMonitoring: vi.fn(),
  useProductionData: vi.fn(),
}))

vi.mock("@/components/monitoring-provider", () => monitoringMocks)

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement("a", null, children),
}))

import { DashboardContent } from "@/components/dashboard-content"

const unknownMonitoring = {
  backend: { availability: "unknown", checkedAt: null, detail: "Sin comprobación" },
  nodes: { availability: "unknown", checkedAt: null, detail: "Sin comprobación", online: 0, offline: 0, unknown: 0 },
  camera: { availability: "unknown", checkedAt: null, detail: "Fuera de supervisión" },
  overall: { availability: "unknown", checkedAt: null, detail: "Sin comprobación" },
  sync: { lotes: { lastQueryAt: null, lastDataEventAt: null, lastConfirmedAt: null, freshness: "never" }, nodos: { lastQueryAt: null, lastDataEventAt: null, lastConfirmedAt: null, freshness: "never" } },
}

monitoringMocks.useMonitoring.mockReturnValue(unknownMonitoring)

describe("panel principal sin base evaluable", () => {
  it("usa los datos actualizados entregados por el hook", () => {
    monitoringMocks.useProductionData.mockReturnValue({ runs: [], lastSyncAt: null, error: null, loading: false })
    const html = renderToStaticMarkup(React.createElement(DashboardContent, { runs: [], lastSyncAt: null }))
    expect(html).toContain("Sincronización de lotes")
    expect(html).toContain("Sin confirmar")
  })

  it("no muestra conteos ni ausencia de alertas durante un error", () => {
    monitoringMocks.useProductionData.mockReturnValue({ runs: [], lastSyncAt: null, error: "API caída", loading: false })
    const html = renderToStaticMarkup(
      React.createElement(DashboardContent, {
        runs: [],
        lastSyncAt: null,
        error: "API caída",
      }),
    )

    expect(html).toContain("consulta no disponible")
    expect(html).toContain("Sin datos para evaluar")
    expect(html).toContain("Consulta no disponible")
    expect(html).not.toContain("0 unidades")
    expect(html).not.toContain("Sin desvíos críticos")
  })

  it("mantiene conteos cero para un vacío válido, pero no inventa alertas", () => {
    monitoringMocks.useProductionData.mockReturnValue({ runs: [], lastSyncAt: new Date().toISOString(), error: null, loading: false })
    const html = renderToStaticMarkup(
      React.createElement(DashboardContent, {
        runs: [],
        lastSyncAt: new Date().toISOString(),
      }),
    )

    expect(html).toContain(">0</strong> unidades")
    expect(html).toContain(">0</strong> lotes consultados")
    expect(html).toContain("Sin datos para evaluar")
    expect(html).not.toContain("Sin desvíos críticos")
  })
})
