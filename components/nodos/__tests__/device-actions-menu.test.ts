// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeviceActionsMenu } from "@/components/nodos/device-actions-menu"
import type { Device } from "@/lib/devices-data"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/actions/api", () => ({
  updateDispositivo: vi.fn(),
}))

const at = "2026-01-01T10:00:00.000Z"

function device(overrides: Partial<Device> = {}): Device {
  return {
    dispositivoId: "node-1",
    nombre: "Nodo 1",
    ubicacion: "Línea A",
    estado: "online",
    lastSeen: at,
    authStatus: "active",
    ...overrides,
  }
}

async function openEditDialog() {
  render(React.createElement(DeviceActionsMenu, { device: device() }))
  fireEvent.click(screen.getByLabelText("Editar metadatos"))
  await screen.findByText("Editar dispositivo")
}

describe("acción de edición del nodo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("expone un botón directo de edición y ninguna acción de ciclo de vida", () => {
    render(React.createElement(DeviceActionsMenu, { device: device() }))

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

  it("abre el diálogo de edición con nombre, ubicación y cámara", async () => {
    await openEditDialog()

    expect(screen.getByLabelText("Nombre")).toBeTruthy()
    expect(screen.getByLabelText("Ubicación")).toBeTruthy()
    expect(screen.getByLabelText("URL WHEP (cámara)")).toBeTruthy()
  })
})
