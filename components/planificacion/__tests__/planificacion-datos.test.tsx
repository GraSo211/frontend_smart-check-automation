// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanificacionDatos } from "@/components/planificacion/planificacion-datos"

const refresh = vi.fn()

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock("sonner", () => ({ toast: toasts }))

describe("PlanificacionDatos", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    refresh.mockClear()
    toasts.success.mockClear()
    toasts.error.mockClear()
  })

  const baseProps = {
    plan: {
      total: 1,
      truncada: false,
      items: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          sector_id: "s-1",
          sector_nombre: "Sector 1",
          producto_id: "p-1",
          producto_nombre: "Producto 1",
          fecha: "2026-11-01",
          turno: "mañana",
          inicio_at: "2026-11-01T06:00:00.000Z",
          fin_at: "2026-11-01T14:00:00.000Z",
          kg_plan: 1200,
        },
      ],
    },
    paradas: { total: 0, truncada: false, items: [] },
    errors: {},
  }

  it("renderiza los tabs y la tabla del plan", () => {
    render(<PlanificacionDatos {...baseProps} />)

    expect(
      screen.getByRole("tab", { name: /Plan de producción/i }),
    ).toBeTruthy()
    expect(screen.getByRole("tab", { name: /Paradas/i })).toBeTruthy()
    expect(screen.getByText("Sector 1")).toBeTruthy()
    expect(screen.getByText("Producto 1")).toBeTruthy()
    expect(screen.getByText("1.200")).toBeTruthy()
  })

  it("muestra estado vacío cuando no hay registros", () => {
    render(
      <PlanificacionDatos
        {...baseProps}
        plan={{ total: 0, truncada: false, items: [] }}
      />,
    )

    expect(screen.getByText(/Sin datos cargados/i)).toBeTruthy()
  })

  it("muestra error de carga cuando se pasa error", () => {
    render(
      <PlanificacionDatos
        {...baseProps}
        errors={{ plan: "No se pudo cargar el plan" }}
      />,
    )

    expect(screen.getByText(/No se pudo cargar el plan/i)).toBeTruthy()
  })

  it("cambia de tab al hacer click", () => {
    render(
      <PlanificacionDatos
        {...baseProps}
        paradas={{
          total: 1,
          truncada: false,
          items: [
            {
              id: "00000000-0000-0000-0000-000000000002",
              sector_id: "s-1",
              sector_nombre: "Sector 1",
              lote_id: null,
              inicio_at: "2026-11-01T10:00:00.000Z",
              fin_at: "2026-11-01T11:00:00.000Z",
              causa_codigo: "MANTENIMIENTO",
              tipo: "NO_PLANIFICADA",
              notas: "cambio de cinta",
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole("tab", { name: /Paradas/i }))
    expect(screen.getByText("MANTENIMIENTO")).toBeTruthy()
  })

  it("elimina un registro tras confirmar", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response),
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<PlanificacionDatos {...baseProps} />)

    fireEvent.click(
      screen.getByRole("button", { name: /Eliminar registro del plan/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /^Sí$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/planificacion/plan/00000000-0000-0000-0000-000000000001",
        { method: "DELETE" },
      )
      expect(toasts.success).toHaveBeenCalledWith("Registro eliminado.")
      expect(refresh).toHaveBeenCalled()
    })
  })

  it("muestra toast de error si el DELETE falla", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            success: false,
            message: "No autorizado",
          }),
      } as Response),
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<PlanificacionDatos {...baseProps} />)

    fireEvent.click(
      screen.getByRole("button", { name: /Eliminar registro del plan/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /^Sí$/i }))

    await waitFor(() => {
      expect(toasts.error).toHaveBeenCalledWith("No autorizado")
    })
  })
})
