// @vitest-environment jsdom

import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { LoteSector } from "@/lib/production-data"
import { SupervisionTable } from "@/components/lotes/supervision-table"

function lote(overrides: Partial<LoteSector> = {}): LoteSector {
  return {
    id: "l-1",
    sector_id: "s-1",
    estado: "ABIERTO",
    producto_id: "p-1",
    producto_nombre: "Pan",
    abierto_en: "2026-09-23T08:00:00.000Z",
    abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
    conteos: { ok: 90, crudo: 2, quemado: 8, total: 100 },
    ultimo_evento_en: "2026-09-23T09:00:00.000Z",
    inactividad_segundos: 12.5,
    cerrado_en: null,
    motivo_cierre: null,
    ...overrides,
  }
}

describe("SupervisionTable · link directo al control del lote", () => {
  it("renderiza el link «Control» por cada fila cuando el rol es Supervisor", () => {
    const runs = [
      lote({ id: "lote-a", producto_nombre: "Pan" }),
      lote({ id: "lote-b", producto_nombre: "Facturas" }),
    ]

    render(<SupervisionTable runs={runs} userRole="Supervisor" />)

    const links = screen.getAllByRole("link", { name: /Abrir control del lote/ })
    expect(links).toHaveLength(2)
    expect(links[0]?.getAttribute("href")).toBe("/lotes/lote-a/control")
    expect(links[1]?.getAttribute("href")).toBe("/lotes/lote-b/control")
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeTruthy()
  })

  it("renderiza el link también para Administrador (jerarquía superior)", () => {
    const runs = [lote({ id: "lote-admin" })]

    render(<SupervisionTable runs={runs} userRole="Administrador" />)

    const link = screen.getByRole("link", { name: /Abrir control del lote lote-admin/ })
    expect(link.getAttribute("href")).toBe("/lotes/lote-admin/control")
  })

  it("oculta el link en lotes cerrados pero mantiene la columna Acciones", () => {
    const runs = [
      lote({ id: "lote-abierto", producto_nombre: "Pan" }),
      lote({
        id: "lote-cerrado",
        producto_nombre: "Facturas",
        estado: "CERRADO",
        cerrado_en: "2026-09-23T10:00:00.000Z",
        motivo_cierre: "cierre manual",
      }),
    ]

    render(<SupervisionTable runs={runs} userRole="Supervisor" />)

    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeTruthy()
    const links = screen.getAllByRole("link", { name: /Abrir control del lote/ })
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute("href")).toBe("/lotes/lote-abierto/control")
    expect(screen.queryByRole("link", { name: /Abrir control del lote lote-cerrado/ })).toBeNull()
  })

  it("muestra Trazabilidad para Operario y mantiene la columna Acciones", () => {
    const runs = [lote({ id: "lote-op" })]

    render(<SupervisionTable runs={runs} userRole="Operario" />)

    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Abrir control/ })).toBeNull()
    const link = screen.getByRole("link", {
      name: /Descargar trazabilidad del lote lote-op/,
    })
    expect(link.getAttribute("href")).toContain(
      "/api/reportes/trazabilidad?lote_id=lote-op",
    )
  })

  it("muestra Trazabilidad para un lote cerrado sin rol de control", () => {
    const runs = [
      lote({
        id: "lote-cerrado",
        producto_nombre: "Facturas",
        estado: "CERRADO",
        cerrado_en: "2026-09-23T10:00:00.000Z",
        motivo_cierre: "cierre manual",
      }),
    ]

    render(<SupervisionTable runs={runs} userRole="Operario" />)

    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Abrir control/ })).toBeNull()
    const link = screen.getByRole("link", {
      name: /Descargar trazabilidad del lote lote-cerrado/,
    })
    expect(link.getAttribute("href")).toBe(
      "/api/reportes/trazabilidad?lote_id=lote-cerrado&format=pdf",
    )
  })

  it("asume Operario por defecto si no se pasa la prop userRole", () => {
    const runs = [lote({ id: "lote-default" })]

    render(<SupervisionTable runs={runs} />)

    expect(screen.getByText("Pan")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Abrir control/ })).toBeNull()
    expect(
      screen.getByRole("link", {
        name: /Descargar trazabilidad del lote lote-default/,
      }),
    ).toBeTruthy()
  })
})

describe("SupervisionTable · confianza promedio", () => {
  it("muestra la confianza como porcentaje o «—» cuando es null", () => {
    const runs = [
      lote({ id: "lote-conf", producto_nombre: "Pan", confianza_promedio: 0.873, turno: "mañana" }),
      lote({ id: "lote-sin", producto_nombre: "Facturas", confianza_promedio: null, turno: "mañana" }),
    ]

    render(<SupervisionTable runs={runs} />)

    expect(screen.getByRole("columnheader", { name: "Confianza" })).toBeTruthy()
    expect(screen.getByText("87.3%")).toBeTruthy()
    expect(screen.getAllByText("—")).toHaveLength(1)
  })
})