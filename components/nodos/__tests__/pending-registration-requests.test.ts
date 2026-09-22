// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/actions/api", () => ({
  approveRegistrationRequest: mocks.approve,
  rejectRegistrationRequest: mocks.reject,
}))
vi.mock("@/lib/registration", () => ({
  registrationRemaining: () => ({ expired: false, ms: 600_000, label: "Vence en 10 min" }),
  isRegistrationStale: () => false,
  registrationExpiryClock: () => "10:15",
}))

import { PendingRegistrationRequests } from "@/components/nodos/pending-registration-requests"
import type { RegistrationRequest } from "@/lib/devices-data"

const now = Date.parse("2026-01-01T10:00:00.000Z")

function request(overrides: Partial<RegistrationRequest> = {}): RegistrationRequest {
  return {
    requestId: "req-1",
    hostname: "rasp-01",
    status: "PENDING",
    createdAt: "2026-01-01T09:55:00.000Z",
    expiresAt: "2026-01-01T10:15:00.000Z",
    ...overrides,
  }
}

describe("solicitudes de registro pendientes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("muestra el hostname y el vencimiento de la solicitud", () => {
    render(React.createElement(PendingRegistrationRequests, { requests: [request()], canManage: true, now }))

    expect(screen.getByText("rasp-01")).toBeTruthy()
    expect(screen.getByText(/Vence en 10 min/)).toBeTruthy()
    expect(screen.getByText(/10:15 UTC/)).toBeTruthy()
  })

  it("aprueba la solicitud directamente y refresca el listado", async () => {
    mocks.approve.mockResolvedValue({
      ok: true,
      data: { requestId: "req-1", status: "APPROVED", deviceId: "dev-1" },
    })
    render(React.createElement(PendingRegistrationRequests, { requests: [request()], canManage: true, now }))

    fireEvent.click(screen.getByLabelText("Aprobar la solicitud de rasp-01"))

    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith("req-1"))
    expect(mocks.reject).not.toHaveBeenCalled()
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("pide confirmación antes de rechazar y recién ahí llama a la acción", async () => {
    mocks.reject.mockResolvedValue({ ok: true, data: { requestId: "req-1", status: "REJECTED" } })
    render(React.createElement(PendingRegistrationRequests, { requests: [request()], canManage: true, now }))

    fireEvent.click(screen.getByLabelText("Rechazar la solicitud de rasp-01"))
    await screen.findByText("¿Rechazar la solicitud de rasp-01?")
    expect(mocks.reject).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText("Confirmar el rechazo de rasp-01"))

    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith("req-1"))
    expect(mocks.approve).not.toHaveBeenCalled()
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("no ofrece acciones a quien no puede gestionar", () => {
    render(React.createElement(PendingRegistrationRequests, { requests: [request()], canManage: false, now }))

    expect(screen.getByText("rasp-01")).toBeTruthy()
    expect(screen.queryByText("Aprobar")).toBeNull()
    expect(screen.queryByText("Rechazar")).toBeNull()
  })

  it("distingue el listado vacío del error de carga", () => {
    const { unmount } = render(
      React.createElement(PendingRegistrationRequests, { requests: [], canManage: true, now }),
    )
    expect(screen.getByText("No hay solicitudes pendientes")).toBeTruthy()
    unmount()

    render(
      React.createElement(PendingRegistrationRequests, { requests: [], canManage: true, error: "API caída", now }),
    )
    expect(screen.getByText("API caída")).toBeTruthy()
    expect(screen.queryByText("No hay solicitudes pendientes")).toBeNull()
  })
})
