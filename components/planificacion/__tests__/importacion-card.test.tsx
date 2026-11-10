// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ImportacionCard } from "@/components/planificacion/importacion-card"

describe("ImportacionCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("muestra las columnas esperadas del CSV", () => {
    render(
      <ImportacionCard
        tipo="plan"
        title="Plan de producción"
        description="Desc"
      />,
    )
    expect(
      screen.getByText(
        /sector_id,fecha,turno,producto_id,inicio,fin,kg_plan/i,
      ),
    ).toBeTruthy()
  })

  it("genera un blob al descargar la plantilla", () => {
    const createObjectURL = vi.fn(() => "blob://test")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    render(
      <ImportacionCard
        tipo="paradas"
        title="Paradas"
        description="Desc"
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Descargar plantilla/i }))

    expect(createObjectURL).toHaveBeenCalled()
  })

  it("muestra el resultado y los errores por fila tras importar", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              procesadas: 3,
              insertadas: 2,
              actualizadas: 1,
              errores: [{ fila: 2, mensaje: "sector inválido" }],
            },
          }),
      } as Response),
    )
    vi.stubGlobal("fetch", fetchMock)

    render(
      <ImportacionCard
        tipo="paradas"
        title="Paradas"
        description="Desc"
      />,
    )

    const input = screen.getByLabelText(/Archivo CSV/i)
    const file = new File(["csv"], "paradas.csv", { type: "text/csv" })
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.click(screen.getByRole("button", { name: /^Importar$/i }))

    await waitFor(() => {
      expect(screen.getByText(/Resultado/i)).toBeTruthy()
      expect(screen.getByText(/Procesadas:/i)).toBeTruthy()
      expect(screen.getByText(/Insertadas:/i)).toBeTruthy()
      expect(screen.getByText(/Actualizadas:/i)).toBeTruthy()
      expect(screen.getByText(/Fila 2: sector inválido/i)).toBeTruthy()
    })
  })

  it("muestra el mensaje de error del backend", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            success: false,
            message: "Archivo CSV inválido",
          }),
      } as Response),
    )
    vi.stubGlobal("fetch", fetchMock)

    render(
      <ImportacionCard tipo="plan" title="Plan" description="Desc" />,
    )

    const input = screen.getByLabelText(/Archivo CSV/i)
    const file = new File(["csv"], "plan.csv", { type: "text/csv" })
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.click(screen.getByRole("button", { name: /^Importar$/i }))

    await waitFor(() => {
      expect(screen.getByText(/Archivo CSV inválido/i)).toBeTruthy()
    })
  })
})
