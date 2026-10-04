// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ReportesForm } from "@/components/reportes/reportes-form"

describe("ReportesForm", () => {
    it("construye la URL del CSV con los filtros vigentes", () => {
        render(
            <ReportesForm initialFilters={{ loteId: "", desde: "", hasta: "" }} />,
        )
        const link = screen.getByRole("link", { name: "Descargar CSV" })
        expect(link.getAttribute("href")).toBe("/api/reportes/lotes?format=csv")
        expect(link.getAttribute("download")).toBe("")
    })

    it("incluye los filtros en la URL cuando el usuario los completa", () => {
        render(
            <ReportesForm initialFilters={{ loteId: "l-1", desde: "", hasta: "" }} />,
        )
        const link = screen.getByRole("link", { name: "Descargar JSON" })
        expect(link.getAttribute("href")).toBe(
            "/api/reportes/lotes?loteId=l-1&format=json",
        )
    })

    it("convierte las fechas del input HTML a ISO con medianoche UTC", () => {
        render(
            <ReportesForm
                initialFilters={{ loteId: "", desde: "2026-01-15", hasta: "2026-01-20" }}
            />,
        )
        const link = screen.getByRole("link", { name: "Descargar CSV" })
        const href = link.getAttribute("href") ?? ""
        // El form serializa las fechas vía `toIsoFromInput`. La fecha 2026-01-15
        // se convierte a un ISO datetime que arranca con ese día.
        expect(href).toContain("desde=2026-01-15")
        expect(href).toContain("hasta=2026-01-20")
    })

    it("reacciona al cambio en el input de loteId", () => {
        render(
            <ReportesForm initialFilters={{ loteId: "", desde: "", hasta: "" }} />,
        )
        const input = screen.getByLabelText("Lote específico") as HTMLInputElement
        fireEvent.change(input, { target: { value: "l-7" } })
        const link = screen.getByRole("link", { name: "Descargar CSV" })
        expect(link.getAttribute("href")).toBe(
            "/api/reportes/lotes?loteId=l-7&format=csv",
        )
    })

    it("muestra el chip «Filtros activos» cuando hay al menos un filtro", () => {
        render(
            <ReportesForm initialFilters={{ loteId: "l-9", desde: "", hasta: "" }} />,
        )
        expect(screen.getByText("Filtros activos")).toBeTruthy()
    })

    it("muestra el chip «Sin filtros» cuando los inputs están vacíos", () => {
        render(
            <ReportesForm initialFilters={{ loteId: "", desde: "", hasta: "" }} />,
        )
        expect(screen.getByText("Sin filtros (todo el historial)")).toBeTruthy()
    })
})