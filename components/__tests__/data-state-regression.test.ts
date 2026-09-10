import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAllProductionRuns: vi.fn(),
  getProductosConParametros: vi.fn(),
  getLotesPorProducto: vi.fn(),
}))

vi.mock("@/actions/api", () => mocks)
vi.mock("@/lib/auth", () => ({ getSession: vi.fn().mockResolvedValue({ rol: "Supervisor" }) }))
vi.mock("@/components/dashboard-content", () => ({
  DashboardContent: (props: Record<string, unknown>) =>
    React.createElement("pre", null, JSON.stringify(props)),
}))
vi.mock("@/components/lotes/dashboard-content", () => ({
  DashboardContent: (props: Record<string, unknown>) =>
    React.createElement("pre", null, JSON.stringify(props)),
}))
vi.mock("@/components/configuracion/product-card", () => ({
  default: (props: Record<string, unknown>) => React.createElement("pre", { id: "productos" }, JSON.stringify(props)),
}))
vi.mock("@/components/configuracion/product-parameters", () => ({
  default: (props: Record<string, unknown>) => React.createElement("pre", { id: "parametros" }, JSON.stringify(props)),
}))
vi.mock("@/components/configuracion/parameters-history", () => ({
  ParametersHistory: (props: Record<string, unknown>) => React.createElement("pre", { id: "historial" }, JSON.stringify(props)),
}))

const product = {
  id: "param-1",
  productoId: "prod-1",
  productoNombre: "Producto real",
  pesoReferenciaKg: 1,
  toleranciaPesoPct: 1,
  dimensionBaseCm: 1,
  toleranciaDimensionCm: 1,
  tempMin: 1,
  tempMax: 2,
  velocidadCintaMin: 1,
  velocidadCintaMax: 2,
  activo: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
}

function renderedProps(element: React.ReactElement) {
  return renderToStaticMarkup(element).replaceAll("&quot;", '"')
}

describe("estados sin datos de producción", () => {
  it("conserva un vacío válido y sincroniza sólo la respuesta exitosa", async () => {
    mocks.getAllProductionRuns.mockResolvedValueOnce([])
    const { default: Page } = await import("@/app/(modulos)/page")
    const html = renderedProps(await Page())
    expect(html).toContain('"runs":[]')
    expect(html).toContain('"lastSyncAt":"')
    expect(html).toContain('"error":null')
  })

  it("no reemplaza un error por conteos o datos de respaldo", async () => {
    mocks.getAllProductionRuns.mockRejectedValueOnce(new Error("API caída"))
    const { default: Page } = await import("@/app/(modulos)/page")
    const html = renderedProps(await Page())
    expect(html).toContain('"runs":[]')
    expect(html).toContain('"lastSyncAt":null')
    expect(html).toContain("API caída")
  })

  it("mantiene vacío y error explícitos en la página de lotes", async () => {
    mocks.getAllProductionRuns.mockResolvedValueOnce([])
    const { default: Page } = await import("@/app/(modulos)/lotes/page")
    const empty = renderedProps(await Page())
    expect(empty).toContain('"runs":[]')
    expect(empty).toContain('"lastSyncAt":"')

    mocks.getAllProductionRuns.mockRejectedValueOnce(new Error("lotes no disponibles"))
    const failed = renderedProps(await Page())
    expect(failed).toContain('"runs":[]')
    expect(failed).toContain('"lastSyncAt":null')
    expect(failed).toContain("lotes no disponibles")
  })
})

describe("configuración con fallos parciales", () => {
  it("expone el fallo del listado sin habilitar una configuración ficticia", async () => {
    mocks.getProductosConParametros.mockRejectedValueOnce(new Error("productos no disponibles"))
    const { default: Page } = await import("@/app/(modulos)/configuracion/page")
    const html = renderedProps(await Page({ searchParams: Promise.resolve({}) }))
    expect(html).toContain("productos no disponibles")
    expect(html).toContain('"producto":null')
  })

  it("mantiene parámetros reales aunque falle el historial", async () => {
    mocks.getProductosConParametros.mockResolvedValueOnce([product])
    mocks.getLotesPorProducto.mockRejectedValueOnce(new Error("historial no disponible"))
    const { default: Page } = await import("@/app/(modulos)/configuracion/page")
    const html = renderedProps(await Page({ searchParams: Promise.resolve({ productoId: "prod-1" }) }))
    expect(html).toContain("param-1")
    expect(html).toContain("historial no disponible")
  })
})
