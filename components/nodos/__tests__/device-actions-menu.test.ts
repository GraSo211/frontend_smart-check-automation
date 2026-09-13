// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DeviceActionsMenu } from "@/components/nodos/device-actions-menu"
import type { Device } from "@/lib/devices-data"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/actions/api", () => ({
  disableDispositivo: vi.fn(),
  enableDispositivo: vi.fn(),
  reprovisionDispositivo: vi.fn(),
  revokeDispositivo: vi.fn(),
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

async function openMenu() {
  render(React.createElement(DeviceActionsMenu, { device: device() }))
  fireEvent.click(screen.getByLabelText("Acciones de Nodo 1"))
  await screen.findByText("Revocar credencial")
}

describe("menú de ciclo de vida del nodo", () => {
  it("ofrece las acciones válidas y pide confirmación al revocar", async () => {
    await openMenu()

    expect(screen.getByText("Deshabilitar")).toBeTruthy()
    expect(screen.getByText("Reprovisionar")).toBeTruthy()
    expect(screen.queryByText("Habilitar")).toBeNull()

    fireEvent.click(screen.getByText("Revocar credencial"))
    await screen.findByText("¿Revocar la credencial de este nodo?")
    expect(screen.getByText(/invalidada de inmediato/)).toBeTruthy()
  })

  it("pide confirmación al reprovisionar y aclara que la credencial vieja se invalida", async () => {
    render(React.createElement(DeviceActionsMenu, { device: device({ authStatus: "disabled" }) }))
    fireEvent.click(screen.getByLabelText("Acciones de Nodo 1"))
    await screen.findByText("Reprovisionar")

    expect(screen.getByText("Habilitar")).toBeTruthy()
    expect(screen.queryByText("Deshabilitar")).toBeNull()

    fireEvent.click(screen.getByText("Reprovisionar"))
    await screen.findByText("¿Reprovisionar este nodo?")
    expect(screen.getByText(/credencial anterior/)).toBeTruthy()
  })

  it("ofrece sólo reprovisionar para un nodo revocado", async () => {
    render(React.createElement(DeviceActionsMenu, { device: device({ authStatus: "revoked" }) }))
    fireEvent.click(screen.getByLabelText("Acciones de Nodo 1"))
    await screen.findByText("Reprovisionar")

    expect(screen.queryByText("Revocar credencial")).toBeNull()
    expect(screen.queryByText("Habilitar")).toBeNull()
    expect(screen.queryByText("Deshabilitar")).toBeNull()
  })

  it("no ofrece revocar, habilitar ni deshabilitar para un nodo sin enrolar", async () => {
    // El backend rechaza esas tres transiciones con 409 para `unenrolled`;
    // reprovisionar sigue siendo válido para un dispositivo existente.
    render(React.createElement(DeviceActionsMenu, { device: device({ authStatus: "unenrolled" }) }))
    fireEvent.click(screen.getByLabelText("Acciones de Nodo 1"))
    await screen.findByText("Reprovisionar")

    expect(screen.queryByText("Revocar credencial")).toBeNull()
    expect(screen.queryByText("Habilitar")).toBeNull()
    expect(screen.queryByText("Deshabilitar")).toBeNull()
  })
})
