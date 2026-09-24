import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LoteSector } from "@/lib/production-data"

const mocks = vi.hoisted(() => ({
  getAllLotes: vi.fn(),
  getSectores: vi.fn(),
  getLotes: vi.fn(),
  getLoteAbierto: vi.fn(),
  getProductosConParametros: vi.fn(),
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

const sector = { id: "s-1", nombre: "Horno 1" }

function lote(id: string): LoteSector {
  return {
    id,
    sector_id: "s-1",
    estado: "ABIERTO",
    producto_id: "prod-1",
    producto_nombre: "Producto real",
    abierto_en: "2026-01-01T10:00:00.000Z",
    abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
    conteos: { ok: 1, crudo: null, quemado: 0, total: 1 },
    ultimo_evento_en: "2026-01-01T10:05:00.000Z",
    inactividad_segundos: 1,
  }
}

function renderedProps(element: React.ReactElement) {
  return renderToStaticMarkup(element).replaceAll("&quot;", '"')
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
})

describe("estados sin datos de producción", () => {
  it("conserva un vacío válido y sincroniza sólo la respuesta exitosa", async () => {
    mocks.getAllLotes.mockResolvedValueOnce([])
    const { default: Page } = await import("@/app/(modulos)/page")
    const html = renderedProps(await Page())
    expect(html).toContain('"runs":[]')
    expect(html).toContain('"lastSyncAt":"')
    expect(html).toContain('"error":null')
  })

  it("no reemplaza un error por conteos o datos de respaldo", async () => {
    mocks.getAllLotes.mockRejectedValueOnce(new Error("API caída"))
    const { default: Page } = await import("@/app/(modulos)/page")
    const html = renderedProps(await Page())
    expect(html).toContain('"runs":[]')
    expect(html).toContain('"lastSyncAt":null')
    expect(html).toContain("API caída")
  })

  it("mantiene vacío y error explícitos en la página de lotes", async () => {
    mocks.getSectores.mockResolvedValueOnce([sector])
    mocks.getAllLotes.mockResolvedValueOnce([])
    mocks.getLoteAbierto.mockResolvedValueOnce(null)
    const { default: Page } = await import("@/app/(modulos)/lotes/page")
    const empty = renderedProps(await Page({ searchParams: Promise.resolve({}) }))
    expect(empty).toContain('"runs":[]')
    expect(empty).toContain('"lastSyncAt":"')
    expect(empty).toContain('"initialError":null')
    expect(empty).toContain('"selectedSectorId":"s-1"')

    mocks.getSectores.mockResolvedValueOnce([sector])
    mocks.getAllLotes.mockRejectedValueOnce(new Error("lotes no disponibles"))
    mocks.getLoteAbierto.mockResolvedValueOnce(null)
    const failed = renderedProps(await Page({ searchParams: Promise.resolve({}) }))
    expect(failed).toContain('"runs":[]')
    expect(failed).toContain('"lastSyncAt":null')
    expect(failed).toContain("lotes no disponibles")
  })
})

describe("configuración con fallos parciales", () => {
  it("expone el fallo del listado sin habilitar una configuración ficticia", async () => {
    mocks.getProductosConParametros.mockRejectedValueOnce(new Error("productos no disponibles"))
    mocks.getSectores.mockResolvedValueOnce([])
    const { default: Page } = await import("@/app/(modulos)/configuracion/page")
    const html = renderedProps(await Page({ searchParams: Promise.resolve({}) }))
    expect(html).toContain("productos no disponibles")
    expect(html).toContain('"producto":null')
    expect(html).toContain('"lotes":[]')
    expect(mocks.getLotes).not.toHaveBeenCalled()
  })

  it("mantiene parámetros reales aunque falle el historial", async () => {
    mocks.getProductosConParametros.mockResolvedValueOnce([product])
    mocks.getSectores.mockResolvedValueOnce([sector])
    mocks.getLotes.mockRejectedValueOnce(new Error("historial no disponible"))
    const { default: Page } = await import("@/app/(modulos)/configuracion/page")
    const html = renderedProps(await Page({ searchParams: Promise.resolve({ productoId: "prod-1" }) }))
    expect(html).toContain("param-1")
    expect(html).toContain("historial no disponible")
    expect(mocks.getLotes).toHaveBeenCalledWith("s-1", {
      productoId: "prod-1",
      limite: 100,
      antesDe: undefined,
    })
  })

  it("sigue el cursor del backend y entrega todas las corridas al historial", async () => {
    mocks.getProductosConParametros.mockResolvedValueOnce([product])
    mocks.getSectores.mockResolvedValueOnce([sector])
    mocks.getLotes
      .mockResolvedValueOnce({ items: [lote("cursor-lote-1")], total: 2, siguienteCursor: "cursor-1" })
      .mockResolvedValueOnce({ items: [lote("cursor-lote-2")], total: 2, siguienteCursor: null })
    const { default: Page } = await import("@/app/(modulos)/configuracion/page")
    const html = renderedProps(await Page({ searchParams: Promise.resolve({ productoId: "prod-1" }) }))

    expect(mocks.getLotes).toHaveBeenCalledTimes(2)
    expect(mocks.getLotes).toHaveBeenNthCalledWith(1, "s-1", {
      productoId: "prod-1",
      limite: 100,
      antesDe: undefined,
    })
    expect(mocks.getLotes).toHaveBeenNthCalledWith(2, "s-1", {
      productoId: "prod-1",
      limite: 100,
      antesDe: "cursor-1",
    })
    expect(html).toContain("cursor-lote-1")
    expect(html).toContain("cursor-lote-2")
  })
})
