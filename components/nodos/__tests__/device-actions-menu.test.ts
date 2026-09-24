// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeviceActionsMenu } from "@/components/nodos/device-actions-menu"
import type { Device } from "@/lib/devices-data"
import type { Sector } from "@/lib/production-data"

const updateDispositivo = vi.fn()
const deleteDispositivo = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/actions/api", () => ({
  updateDispositivo: (...args: unknown[]) => updateDispositivo(...args),
  deleteDispositivo: (...args: unknown[]) => deleteDispositivo(...args),
}))

const at = "2026-01-01T10:00:00.000Z"

const sectores: Sector[] = [
  { id: "s1", nombre: "Horneado" },
  { id: "s2", nombre: "Envasado" },
]

function device(overrides: Partial<Device> = {}): Device {
  return {
    dispositivoId: "node-1",
    nombre: "Nodo 1",
    sectorId: "s1",
    estado: "online",
    lastSeen: at,
    authStatus: "active",
    ...overrides,
  }
}

async function openEditDialog(deviceOverride: Partial<Device> = {}) {
  render(React.createElement(DeviceActionsMenu, { device: device(deviceOverride), sectores }))
  fireEvent.click(screen.getByLabelText("Editar metadatos"))
  await screen.findByText("Editar dispositivo")
}

async function openDeleteDialog(deviceOverride: Partial<Device> = {}) {
  render(React.createElement(DeviceActionsMenu, { device: device(deviceOverride), sectores }))
  fireEvent.click(screen.getByLabelText("Eliminar dispositivo"))
  await screen.findByText(/Se revocará su credencial/)
}

describe("acción de edición del nodo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("expone un botón directo de edición y ninguna acción de ciclo de vida", () => {
    render(React.createElement(DeviceActionsMenu, { device: device(), sectores }))

    const trigger = screen.getByLabelText("Editar metadatos")
    expect(trigger.getAttribute("title")).toBe("Editar metadatos")
    expect(trigger.getAttribute("type")).toBe("button")

    // Sin menú desplegable: el nombre sólo vive en el aria-label, no como texto.
    expect(screen.queryByText("Editar metadatos")).toBeNull()
    expect(screen.queryByText("Deshabilitar")).toBeNull()
    expect(screen.queryByText("Habilitar")).toBeNull()
    expect(screen.queryByText("Revocar credencial")).toBeNull()
    expect(screen.queryByText("Reprovisionar")).toBeNull()
  })

  it("abre el diálogo de edición con el nombre en solo lectura, sector y cámara", async () => {
    await openEditDialog()

    const nombreInput = screen.getByLabelText("Nombre") as HTMLInputElement
    // El nombre se muestra pero no se puede editar desde el panel.
    expect(nombreInput.readOnly).toBe(true)
    expect(nombreInput.value).toBe("Nodo 1")
    expect(
      screen.getByText("El nombre solo se puede cambiar desde la propia Raspberry."),
    ).toBeTruthy()

    expect(screen.getByLabelText("Sector")).toBeTruthy()
    expect(screen.getByLabelText("URL WHEP (cámara)")).toBeTruthy()
    // El sector actual del dispositivo queda seleccionado.
    expect((screen.getByLabelText("Sector") as HTMLSelectElement).value).toBe("s1")
  })

  it("permite dejar el nodo sin sector al elegir la opción vacía", async () => {
    updateDispositivo.mockResolvedValue({ ok: true, data: device({ sectorId: undefined }) })
    await openEditDialog()

    fireEvent.change(screen.getByLabelText("Sector"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(updateDispositivo).toHaveBeenCalledWith(
        expect.objectContaining({ dispositivoId: "node-1", sectorId: null }),
      )
    })
  })

  it("envía el sector elegido cuando se cambia", async () => {
    updateDispositivo.mockResolvedValue({ ok: true, data: device({ sectorId: "s2" }) })
    await openEditDialog()

    fireEvent.change(screen.getByLabelText("Sector"), { target: { value: "s2" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(updateDispositivo).toHaveBeenCalledWith(
        expect.objectContaining({ dispositivoId: "node-1", sectorId: "s2" }),
      )
    })
  })

  it("no envía nombre al actualizar: el backend lo rechazaría", async () => {
    updateDispositivo.mockResolvedValue({ ok: true, data: device({ sectorId: "s2" }) })
    await openEditDialog()

    fireEvent.change(screen.getByLabelText("Sector"), { target: { value: "s2" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(updateDispositivo).toHaveBeenCalledTimes(1)
    })
    const payload = updateDispositivo.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty("nombre")
  })
})

describe("acción de eliminación del nodo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("expone un botón de eliminación accesible por aria-label", () => {
    render(React.createElement(DeviceActionsMenu, { device: device(), sectores }))

    const trigger = screen.getByLabelText("Eliminar dispositivo")
    expect(trigger.getAttribute("title")).toBe("Eliminar dispositivo")
    expect(trigger.getAttribute("type")).toBe("button")
  })

  it("abre el diálogo de confirmación con el nombre del dispositivo", async () => {
    await openDeleteDialog()

    expect(
      screen.getByText(
        '¿Confirmás que querés eliminar el dispositivo "Nodo 1" de la flota? Se revocará su credencial y se desasignará del sector; el historial de telemetría se conserva. El nodo deberá registrarse de nuevo.',
      ),
    ).toBeTruthy()
  })

  it("confirma la eliminación llamando a deleteDispositivo con el id del nodo", async () => {
    deleteDispositivo.mockResolvedValue({ ok: true, data: null })
    await openDeleteDialog()

    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar dispositivo" }))

    await waitFor(() => {
      expect(deleteDispositivo).toHaveBeenCalledWith("node-1")
    })
  })

  it("no elimina cuando se cancela", async () => {
    await openDeleteDialog()

    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    expect(deleteDispositivo).not.toHaveBeenCalled()
  })
})
