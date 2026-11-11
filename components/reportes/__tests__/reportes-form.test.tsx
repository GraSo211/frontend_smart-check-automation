// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ReportesForm } from "@/components/reportes/reportes-form"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

describe("ReportesForm", () => {
  const productoBase = {
    id: "p-1",
    nombre: "Producto 1",
    activo: true,
    pesoReferenciaKg: 1,
    tempMin: 100,
    tempMax: 200,
    velocidadCintaMin: 1,
    velocidadCintaMax: 10,
    capacidadNominalKgH: null,
  }

  const baseProps = {
    appliedFilters: {
      desde: "2026-01-01",
      hasta: "2026-01-31",
      sectorId: "",
      productoId: "",
      turno: "",
    },
    sectores: [{ id: "s-1", nombre: "Sector 1" }],
    productos: [productoBase],
    catalogErrors: {},
    lotesTotal: 12,
  }

  it("usa los filtros aplicados en los links de descarga", () => {
    render(<ReportesForm {...baseProps} />)
    const csv = screen.getByRole("link", { name: "CSV" })
    const excel = screen.getByRole("link", { name: /Excel es-AR/i })
    const json = screen.getByRole("link", { name: /JSON/i })

    expect(csv.getAttribute("href")).toBe(
      "/api/reportes/lotes?desde=2026-01-01&hasta=2026-01-31&format=csv&delim=%2C",
    )
    expect(excel.getAttribute("href")).toContain("delim=%3B")
    expect(json.getAttribute("href")).toBe(
      "/api/reportes/lotes?desde=2026-01-01&hasta=2026-01-31&format=json",
    )
  })

  it("incluye filtros aplicados en las descargas sin mezclar con ediciones sin aplicar", () => {
    render(<ReportesForm {...baseProps} />)
    const input = screen.getByLabelText("Sector")
    fireEvent.change(input, { target: { value: "s-1" } })

    const csv = screen.getByRole("link", { name: "CSV" })
    expect(csv.getAttribute("href")).not.toContain("sector_id=s-1")
  })

  it("navega con los filtros editados al aplicar", () => {
    render(<ReportesForm {...baseProps} />)
    const sector = screen.getByLabelText("Sector")
    fireEvent.change(sector, { target: { value: "s-1" } })

    const apply = screen.getByRole("button", { name: /Aplicar filtros/i })
    fireEvent.click(apply)

    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("sector_id=s-1"),
    )
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("desde=2026-01-01"),
    )
  })

  it("limpia los filtros al hacer click en Limpiar", () => {
    render(
      <ReportesForm
        {...baseProps}
        appliedFilters={{ ...baseProps.appliedFilters, sectorId: "s-1" }}
      />,
    )
    const clear = screen.getByRole("button", { name: /Limpiar/i })
    fireEvent.click(clear)

    expect(push).toHaveBeenCalledWith("/reportes")
  })

  it("el link PDF incluye los filtros aplicados", () => {
    render(
      <ReportesForm
        {...baseProps}
        appliedFilters={{ ...baseProps.appliedFilters, sectorId: "s-1" }}
      />,
    )
    const pdf = screen.getByRole("link", { name: "PDF" })
    expect(pdf.getAttribute("href")).toBe(
      "/api/reportes/lotes?desde=2026-01-01&hasta=2026-01-31&sector_id=s-1&format=pdf",
    )
  })

  it("el link Alertas CSV incluye los filtros aplicados", () => {
    render(
      <ReportesForm
        {...baseProps}
        appliedFilters={{
          desde: "2026-01-01",
          hasta: "2026-01-31",
          sectorId: "s-1",
          productoId: "p-1",
          turno: "tarde",
        }}
      />,
    )
    const alertas = screen.getByRole("link", { name: "Alertas CSV" })
    expect(alertas.getAttribute("href")).toBe(
      "/api/reportes/alertas?desde=2026-01-01&hasta=2026-01-31&sector_id=s-1&producto_id=p-1&turno=tarde&format=csv",
    )
  })

  it("muestra la cantidad de lotes cuando está disponible", () => {
    render(<ReportesForm {...baseProps} />)
    expect(screen.getByText(/12 lotes en el período/i)).toBeTruthy()
  })

  it("habilita la descarga de trazabilidad con un UUID válido", () => {
    render(<ReportesForm {...baseProps} />)
    const input = screen.getByLabelText("ID del lote")
    fireEvent.change(input, {
      target: { value: "550e8400-e29b-41d4-a716-446655440000" },
    })

    const link = screen.getByRole("link", {
      name: /Descargar PDF de trazabilidad/i,
    })
    expect(link.getAttribute("href")).toBe(
      "/api/reportes/trazabilidad?lote_id=550e8400-e29b-41d4-a716-446655440000&format=pdf",
    )

    const csv = screen.getByRole("link", {
      name: "Descargar CSV de trazabilidad",
    })
    expect(csv.getAttribute("href")).toBe(
      "/api/reportes/trazabilidad?lote_id=550e8400-e29b-41d4-a716-446655440000&format=csv&dataset=proceso",
    )
  })

  it("actualiza el link CSV al cambiar el dataset", () => {
    render(<ReportesForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText("ID del lote"), {
      target: { value: "550e8400-e29b-41d4-a716-446655440000" },
    })
    fireEvent.change(screen.getByLabelText("Dataset"), {
      target: { value: "decisiones" },
    })

    const csv = screen.getByRole("link", {
      name: "Descargar CSV de trazabilidad",
    })
    expect(csv.getAttribute("href")).toBe(
      "/api/reportes/trazabilidad?lote_id=550e8400-e29b-41d4-a716-446655440000&format=csv&dataset=decisiones",
    )
  })

  it("deshabilita la descarga de trazabilidad con un ID inválido", () => {
    render(<ReportesForm {...baseProps} />)
    const input = screen.getByLabelText("ID del lote")
    fireEvent.change(input, { target: { value: "no-valido" } })

    const button = screen.getByRole("button", {
      name: /Descargar PDF de trazabilidad/i,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(
      screen.queryByRole("link", { name: "Descargar CSV de trazabilidad" }),
    ).toBeNull()
    expect(screen.getByText(/El ID no tiene formato válido/i)).toBeTruthy()
  })
})
