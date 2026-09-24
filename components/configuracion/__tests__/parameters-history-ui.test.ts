// @vitest-environment jsdom
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
import { ParametersHistory } from "@/components/configuracion/parameters-history"
import type { LoteSector } from "@/lib/production-data"

function makeLote(overrides: Partial<LoteSector> = {}): LoteSector {
  return {
    id: "l-1",
    sector_id: "s-1",
    estado: "CERRADO",
    producto_id: "p-1",
    producto_nombre: "Producto",
    abierto_en: "2026-01-01T00:00:00Z",
    conteos: { ok: 90, crudo: 5, quemado: 5, total: 100 },
    inactividad_segundos: 0,
    cerrado_en: "2026-01-01T01:00:00Z",
    motivo_cierre: "Normal",
    ...overrides,
  }
}

const sectores = [
  { id: "s-1", nombre: "Sector 1" },
  { id: "s-2", nombre: "Sector 2" },
]

describe("ParametersHistory (contrato sector/lotes)", () => {
  it("renderiza columnas reales y placeholders del contrato retirado", () => {
    const html = renderToStaticMarkup(
      React.createElement(ParametersHistory, {
        lotes: [makeLote()],
        productoNombre: "Producto",
        productoId: "p-1",
        sectores,
        sector: sectores[0],
        selectedSectorId: "s-1",
      }),
    )

    expect(html).toContain("Correctos")
    expect(html).toContain("Quemados")
    expect(html).toContain("Crudas")
    expect(html).toContain("Motivo de cierre")
    expect(html).toContain("Horno 1")
    expect(html).toContain("Horno 2")
    expect(html).toContain("Vel. cinta")
    expect(html).toContain("Sector 1")
    expect(html).toContain("100")
    expect(html).toContain("Normal")
    // Turno ya está en el contrato pero es opcional (lotes legacy): sin valor
    // cae al placeholder, igual que Horno 1, Horno 2 y Vel. cinta.
    expect((html.match(/—/g) ?? []).length).toBe(4)
  })

  it("renderiza el turno provisto y el placeholder cuando falta", () => {
    const conTurno = renderToStaticMarkup(
      React.createElement(ParametersHistory, {
        lotes: [makeLote({ turno: "mañana" })],
        productoNombre: "Producto",
        sectores,
        selectedSectorId: "s-1",
      }),
    )
    expect(conTurno).toContain("mañana")
    expect((conTurno.match(/—/g) ?? []).length).toBe(3)

    const sinTurno = renderToStaticMarkup(
      React.createElement(ParametersHistory, {
        lotes: [makeLote()],
        productoNombre: "Producto",
        sectores,
        selectedSectorId: "s-1",
      }),
    )
    expect((sinTurno.match(/—/g) ?? []).length).toBe(4)
  })

  it("marca una corrida abierta como en curso", () => {
    const html = renderToStaticMarkup(
      React.createElement(ParametersHistory, {
        lotes: [makeLote({ estado: "ABIERTO", cerrado_en: null, motivo_cierre: null })],
        productoNombre: "Producto",
        sectores,
        selectedSectorId: "s-1",
      }),
    )
    expect(html).toContain("en curso")
    expect(html).toContain("ABIERTO")
  })

  it("pagina en el cliente sobre el arreglo provisto", () => {
    const lotes = Array.from({ length: 12 }, (_, index) =>
      makeLote({ id: `l-${index + 1}` }),
    )
    const view = render(
      React.createElement(ParametersHistory, {
        lotes,
        productoNombre: "Producto",
        productoId: "p-1",
        sectores,
        selectedSectorId: "s-1",
      }),
    )

    expect(screen.getByText("12 corridas")).toBeTruthy()
    expect(screen.getByText(/Página 1 de 2/)).toBeTruthy()
    expect(view.container.querySelectorAll("tbody tr").length).toBe(10)

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))

    expect(screen.getByText(/Página 2 de 2/)).toBeTruthy()
    expect(view.container.querySelectorAll("tbody tr").length).toBe(2)
  })
})
