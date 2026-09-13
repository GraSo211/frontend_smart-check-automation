import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { EnrollmentCodePanel } from "@/components/nodos/enrollment-code-panel"
import { PendingInvitations } from "@/components/nodos/pending-invitations"
import { DeviceCard } from "@/components/nodos/device-card"
import type { Device, EnrollmentInvitation } from "@/lib/devices-data"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/actions/api", () => ({
  cancelEnrollment: vi.fn(),
  disableDispositivo: vi.fn(),
  enableDispositivo: vi.fn(),
  reprovisionDispositivo: vi.fn(),
  revokeDispositivo: vi.fn(),
  updateDispositivo: vi.fn(),
}))
vi.mock("@/components/nodos/device-actions-menu", () => ({
  DeviceActionsMenu: ({ device }: { device: { nombre: string } }) =>
    React.createElement("button", { type: "button", "aria-label": `Acciones de ${device.nombre}` }, "menu"),
}))

const now = Date.parse("2026-01-01T10:00:00.000Z")

function output(element: React.ReactElement) {
  return renderToStaticMarkup(element)
}

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    dispositivoId: "node-000000000001",
    nombre: "Nodo 1",
    ubicacion: "Línea A",
    estado: "online",
    lastSeen: "2026-01-01T10:00:00.000Z",
    ...overrides,
  }
}

const invitation: EnrollmentInvitation = {
  enrollmentId: "enr-1",
  dispositivoId: null,
  nombre: "Nodo Nuevo",
  ubicacion: "Línea B",
  status: "pending",
  createdAt: "2026-01-01T09:55:00.000Z",
  expiresAt: "2026-01-01T10:15:00.000Z",
}

describe("panel de código de aprovisionamiento", () => {
  it("muestra el código una sola vez con copia, vencimiento e instrucciones", () => {
    const html = output(
      React.createElement(EnrollmentCodePanel, {
        code: "codigo-de-uso-unico",
        expiresAt: "2026-01-01T10:15:00.000Z",
        nombre: "Nodo Nuevo",
        now,
      }),
    )
    expect(html).toContain("codigo-de-uso-unico")
    expect(html).toContain("Código de uso único")
    expect(html).toContain("Copiar")
    expect(html).toContain("device_enrollment enroll")
    expect(html).toContain("DEVICE_ENROLLMENT_CODE")
    expect(html).toContain("un solo uso")
    expect(html).toContain("no se puede volver a")
    expect(html).toContain("Ingresá el código en la Raspberry de Nodo Nuevo")
  })

  it("oculta el código cuando la invitación venció", () => {
    const html = output(
      React.createElement(EnrollmentCodePanel, {
        code: "codigo-de-uso-unico",
        expiresAt: "2026-01-01T09:00:00.000Z",
        now,
      }),
    )
    expect(html).not.toContain("codigo-de-uso-unico")
    expect(html).toContain("venció")
    expect(html).toContain("generá una nueva")
  })
})

describe("solicitudes pendientes", () => {
  it("muestra nombre, ubicación y vencimiento separados de la flota", () => {
    const html = output(
      React.createElement(PendingInvitations, { invitations: [invitation], canManage: true, now }),
    )
    expect(html).toContain("Nodo Nuevo")
    expect(html).toContain("Línea B")
    expect(html).toContain("Nuevo nodo")
    expect(html).toContain("Vence en 15 min")
    expect(html).toContain("10:15 UTC")
    expect(html).toContain("Cancelar")
  })

  it("oculta el control de cancelación para Operario", () => {
    const html = output(
      React.createElement(PendingInvitations, { invitations: [invitation], canManage: false, now }),
    )
    expect(html).toContain("Nodo Nuevo")
    expect(html).not.toContain("Cancelar")
    expect(html).not.toContain("deja de ser válido")
  })

  it("marca una invitación vencida y una reprovisión", () => {
    const html = output(
      React.createElement(PendingInvitations, {
        invitations: [
          { ...invitation, dispositivoId: "node-1", expiresAt: "2026-01-01T09:00:00.000Z" },
        ],
        canManage: true,
        now,
      }),
    )
    expect(html).toContain("Reprovisión")
    expect(html).toContain("Vencida")
  })

  it("distingue el error de carga de un listado vacío válido", () => {
    const errorHtml = output(
      React.createElement(PendingInvitations, { invitations: [], canManage: true, error: "API caída", now }),
    )
    expect(errorHtml).toContain("API caída")
    expect(errorHtml).not.toContain("No hay solicitudes pendientes")

    const emptyHtml = output(
      React.createElement(PendingInvitations, { invitations: [], canManage: true, now }),
    )
    expect(emptyHtml).toContain("No hay solicitudes pendientes")
  })
})

describe("estado de credencial separado de la conectividad", () => {
  it("muestra un nodo deshabilitado que sigue online sin sugerir que puede reportar", () => {
    const html = output(
      React.createElement(DeviceCard, {
        device: baseDevice({ authStatus: "disabled" }),
        selected: false,
        onSelect: () => undefined,
        canManage: true,
      }),
    )
    expect(html).toContain("Online")
    expect(html).toContain("Deshabilitado")
    expect(html).toContain("no puede reportar")
    expect(html).toContain("Acciones de Nodo 1")
  })

  it("marca los nodos revocados y sin enrolar", () => {
    const revoked = output(
      React.createElement(DeviceCard, {
        device: baseDevice({ authStatus: "revoked" }),
        selected: false,
        onSelect: () => undefined,
        canManage: true,
      }),
    )
    expect(revoked).toContain("Revocado")
    expect(revoked).toContain("requiere reprovisión")

    const legacy = output(
      React.createElement(DeviceCard, {
        device: baseDevice(),
        selected: false,
        onSelect: () => undefined,
        canManage: true,
      }),
    )
    expect(legacy).toContain("Sin enrolar")
  })

  it("oculta las acciones de gestión para Operario", () => {
    const html = output(
      React.createElement(DeviceCard, {
        device: baseDevice({ authStatus: "active" }),
        selected: false,
        onSelect: () => undefined,
        canManage: false,
      }),
    )
    expect(html).toContain("Activo")
    expect(html).not.toContain("Acciones de Nodo 1")
  })
})
