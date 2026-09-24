// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SectorManagement } from "@/components/sectores/sector-management"
import type { Device } from "@/lib/devices-data"
import type { Sector } from "@/lib/production-data"

const api = vi.hoisted(() => ({
  getSectores: vi.fn(),
  createSector: vi.fn(),
  updateSector: vi.fn(),
  deleteSector: vi.fn(),
}))
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: toasts }))
vi.mock("@/actions/api", () => ({
  getSectores: api.getSectores,
  createSector: api.createSector,
  updateSector: api.updateSector,
  deleteSector: api.deleteSector,
}))

const at = "2026-01-01T10:00:00.000Z"

const sectores: Sector[] = [
  { id: "s1", nombre: "Horneado" },
  { id: "s2", nombre: "Envasado" },
]

function device(id: string, sectorId?: string): Device {
  return { dispositivoId: id, nombre: id, sectorId, estado: "online", lastSeen: at }
}

describe("SectorManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("muestra los sectores con la cantidad de dispositivos y los sin asignar", () => {
    render(
      React.createElement(SectorManagement, {
        initialSectores: sectores,
        devices: [device("d1", "s1"), device("d2", "s1"), device("d3")],
        canManage: true,
      }),
    )

    expect(screen.getAllByText("Horneado").length).toBeGreaterThan(0)
    expect(screen.getAllByText("2 dispositivos").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Envasado").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Sin dispositivos").length).toBeGreaterThan(0)
    expect(screen.getByText("Dispositivos sin sector")).toBeTruthy()
  })

  it("valida que el nombre no esté vacío", async () => {
    render(
      React.createElement(SectorManagement, {
        initialSectores: sectores,
        devices: [],
        canManage: true,
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Nuevo Sector" }))
    fireEvent.click(await screen.findByRole("button", { name: "Crear sector" }))

    expect(await screen.findByText("El nombre es obligatorio.")).toBeTruthy()
    expect(api.createSector).not.toHaveBeenCalled()
  })

  it("rechaza un nombre duplicado sin llamar al backend", async () => {
    render(
      React.createElement(SectorManagement, {
        initialSectores: sectores,
        devices: [],
        canManage: true,
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Nuevo Sector" }))
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "horneado" } })
    fireEvent.click(screen.getByRole("button", { name: "Crear sector" }))

    expect(await screen.findByText("Ya existe un sector con ese nombre.")).toBeTruthy()
    expect(api.createSector).not.toHaveBeenCalled()
  })

  it("crea un sector válido y lo confirma con un toast", async () => {
    api.createSector.mockResolvedValue({ ok: true, data: { id: "s3", nombre: "Empaque" } })
    api.getSectores.mockResolvedValue([...sectores, { id: "s3", nombre: "Empaque" }])

    render(
      React.createElement(SectorManagement, {
        initialSectores: sectores,
        devices: [],
        canManage: true,
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Nuevo Sector" }))
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Empaque" } })
    fireEvent.click(screen.getByRole("button", { name: "Crear sector" }))

    await waitFor(() => expect(api.createSector).toHaveBeenCalledWith({ nombre: "Empaque" }))
    expect(toasts.success).toHaveBeenCalledWith("Sector creado.")
  })

  it("traduce el 409 de borrado a un mensaje claro", async () => {
    api.deleteSector.mockResolvedValue({
      ok: false,
      errors: ["El sector tiene lotes asociados y no se puede eliminar."],
      code: "sector_in_use",
    })

    render(
      React.createElement(SectorManagement, {
        initialSectores: sectores,
        devices: [device("d1", "s1")],
        canManage: true,
      }),
    )

    fireEvent.click(screen.getByLabelText("Eliminar Horneado"))
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar sector" }))

    await waitFor(() => expect(api.deleteSector).toHaveBeenCalledWith("s1"))
    expect(toasts.error).toHaveBeenCalledWith(
      "No se pudo eliminar el sector",
      expect.objectContaining({ description: expect.stringContaining("lotes asociados") }),
    )
  })

  it("oculta las acciones de gestión a un Operario", () => {
    render(
      React.createElement(SectorManagement, {
        initialSectores: sectores,
        devices: [],
        canManage: false,
      }),
    )

    expect(screen.queryByRole("button", { name: "Nuevo Sector" })).toBeNull()
    expect(screen.queryByLabelText("Eliminar Horneado")).toBeNull()
    expect(screen.queryByLabelText("Editar Horneado")).toBeNull()
  })
})
