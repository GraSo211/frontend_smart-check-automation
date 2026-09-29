import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { LoteSector } from "@/lib/production-data"

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

// A sector/lote fixture. `conteos` buckets are nullable: `null` means the state
// was not produced, never 0.
function lote(overrides: Partial<LoteSector> = {}): LoteSector {
  return {
    id: "lote-1",
    sector_id: "sector-1",
    estado: "CERRADO",
    producto_id: "prod-1",
    producto_nombre: "Producto de prueba",
    abierto_en: "2026-01-01T06:00:00.000Z",
    abierto_por: { device_id: "dev-1", type: "ENTRADA_HORNO" },
    conteos: { ok: 90, crudo: 4, quemado: 6, total: 100 },
    ultimo_evento_en: "2026-01-01T07:00:00.000Z",
    inactividad_segundos: 0,
    cerrado_en: "2026-01-01T08:00:00.000Z",
    motivo_cierre: null,
    ...overrides,
  }
}

describe("panel principal sin base evaluable", () => {
  it("usa los datos actualizados entregados por el hook", () => {
    monitoringMocks.useProductionData.mockReturnValue({ runs: [], lastSyncAt: null, error: null, loading: false, truncated: false })
    const html = renderToStaticMarkup(React.createElement(DashboardContent, { runs: [], lastSyncAt: null }))
    expect(html).toContain("Sincronización de lotes")
    expect(html).toContain("Sin confirmar")
  })

  it("no muestra conteos ni ausencia de alertas durante un error", () => {
    monitoringMocks.useProductionData.mockReturnValue({ runs: [], lastSyncAt: null, error: "API caída", loading: false, truncated: false })
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
    monitoringMocks.useProductionData.mockReturnValue({ runs: [], lastSyncAt: new Date().toISOString(), error: null, loading: false, truncated: false })
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

  it("calcula los indicadores reales desde conteos y deja kg/temperatura como placeholder", () => {
    const runs = [lote()]
    monitoringMocks.useProductionData.mockReturnValue({ runs, lastSyncAt: new Date().toISOString(), error: null, loading: false, truncated: false })
    const html = renderToStaticMarkup(
      React.createElement(DashboardContent, { runs, lastSyncAt: new Date().toISOString() }),
    )

    // Real metrics derived from `conteos`.
    expect(html).toContain(">100</strong> unidades")
    expect(html).toContain(">1</strong> lotes consultados")
    expect(html).toContain("90.0%")
    expect(html).toContain("Requieren atención")

    // kg is no longer provided: the hero must not fabricate a weight.
    expect(html).not.toContain("kg")
    // Oven temperature is unavailable: it renders "—" with a "Sin medición" hint.
    expect(html).toContain("Sin medición")
  })

  it("trata un bucket nulo como ausente: no publica 0% de calidad", () => {
    const runs = [lote({ conteos: { ok: null, crudo: null, quemado: null, total: 0 } })]
    monitoringMocks.useProductionData.mockReturnValue({ runs, lastSyncAt: new Date().toISOString(), error: null, loading: false, truncated: false })
    const html = renderToStaticMarkup(
      React.createElement(DashboardContent, { runs, lastSyncAt: new Date().toISOString() }),
    )

    expect(html).toContain(">0</strong> unidades")
    expect(html).not.toContain("0.0%")
  })

  it("deriva la calidad del total menos la merma cuando ningún lote emite el bucket ok", () => {
    const runs = [lote({ conteos: { ok: null, crudo: 4, quemado: 6, total: 100 } })]
    monitoringMocks.useProductionData.mockReturnValue({ runs, lastSyncAt: new Date().toISOString(), error: null, loading: false, truncated: false })
    const html = renderToStaticMarkup(
      React.createElement(DashboardContent, { runs, lastSyncAt: new Date().toISOString() }),
    )

    expect(html).toContain(">100</strong> unidades")
    // Sin bucket `ok` los correctos se derivan del total menos los defectos.
    expect(html).toContain("90.0%")
    // The waste-based cards still have a real bucket to work with.
    expect(html).toContain("unidades recuperables")
  })

  it("no publica merma cuando ningún lote emite quemado ni crudo", () => {
    const runs = [lote({ conteos: { ok: 90, crudo: null, quemado: null, total: 100 } })]
    monitoringMocks.useProductionData.mockReturnValue({ runs, lastSyncAt: new Date().toISOString(), error: null, loading: false, truncated: false })
    const html = renderToStaticMarkup(
      React.createElement(DashboardContent, { runs, lastSyncAt: new Date().toISOString() }),
    )

    expect(html).toContain("90.0%")
    expect(html).not.toContain("unidades recuperables")
    expect(html).not.toContain("15% menos")
  })
})
