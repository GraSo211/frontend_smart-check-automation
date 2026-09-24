import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { SectorSelect } from "@/components/shared/sector-select"

const sectores = [
  { id: "s-1", nombre: "Horneado" },
  { id: "s-2", nombre: "Envasado" },
]

describe("SectorSelect", () => {
  it("renderiza el label, las opciones y la opción vacía cuando se permite", () => {
    const html = renderToStaticMarkup(
      React.createElement(SectorSelect, {
        id: "sector",
        label: "Sector",
        value: "s-1",
        onChange: vi.fn(),
        sectores,
        allowEmpty: true,
        emptyOptionLabel: "Sin sector",
      }),
    )

    expect(html).toContain('for="sector"')
    expect(html).toContain("Sin sector")
    expect(html).toContain("Horneado")
    expect(html).toContain("Envasado")
  })

  it("sin opción vacía muestra el aviso cuando no hay sectores", () => {
    const html = renderToStaticMarkup(
      React.createElement(SectorSelect, {
        id: "sector",
        label: "Sector",
        value: "",
        onChange: vi.fn(),
        sectores: [],
      }),
    )

    expect(html).toContain("Sin sectores disponibles")
    expect(html).not.toContain("Sin sector<")
  })

  it("marca el control como inválido y describe el error", () => {
    const html = renderToStaticMarkup(
      React.createElement(SectorSelect, {
        id: "sector",
        ariaLabel: "Sector del nodo",
        value: "",
        onChange: vi.fn(),
        sectores,
        error: "Elegí un sector.",
      }),
    )

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="sector-error"')
    expect(html).toContain("Elegí un sector.")
    expect(html).toContain('aria-label="Sector del nodo"')
  })
})
