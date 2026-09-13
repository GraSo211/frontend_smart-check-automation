import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDevices: vi.fn(),
  getEnrollmentInvitations: vi.fn(),
}))

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, getSession: mocks.getSession }
})
vi.mock("@/actions/api", () => ({
  getDevices: mocks.getDevices,
  getEnrollmentInvitations: mocks.getEnrollmentInvitations,
}))
vi.mock("@/components/nodos/devices-state", () => ({
  default: (props: Record<string, unknown>) => React.createElement("pre", null, JSON.stringify(props)),
}))
vi.mock("@/components/nodos/enrollment-invite-dialog", () => ({
  default: () => React.createElement("button", { type: "button" }, "Nueva solicitud de enrolamiento"),
}))

function output(element: React.ReactElement) {
  return renderToStaticMarkup(element).replaceAll("&quot;", '"')
}

describe("gating de rol en la página de nodos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDevices.mockResolvedValue([])
    mocks.getEnrollmentInvitations.mockResolvedValue([])
  })

  it("ofrece gestión y el modal de invitación a un Supervisor", async () => {
    mocks.getSession.mockResolvedValue({ email: "s@test", nombre: "Sup", rol: "Supervisor" })
    const { default: Page } = await import("@/app/(modulos)/nodos/page")

    const html = output(await Page())
    expect(html).toContain("Nueva solicitud de enrolamiento")
    expect(html).not.toContain("Sólo lectura")
    expect(html).toContain('"canManage":true')
  })

  it("deja a un Operario en sólo lectura sin modal de creación", async () => {
    mocks.getSession.mockResolvedValue({ email: "o@test", nombre: "Op", rol: "Operario" })
    const { default: Page } = await import("@/app/(modulos)/nodos/page")

    const html = output(await Page())
    expect(html).not.toContain("Nueva solicitud de enrolamiento")
    expect(html).toContain("Sólo lectura")
    expect(html).toContain('"canManage":false')
  })

  it("distingue el error de invitaciones de un listado vacío", async () => {
    mocks.getSession.mockResolvedValue({ email: "s@test", nombre: "Sup", rol: "Supervisor" })
    mocks.getEnrollmentInvitations.mockRejectedValueOnce(new Error("API caída"))
    const { default: Page } = await import("@/app/(modulos)/nodos/page")

    const html = output(await Page())
    expect(html).toContain('"invitationsError":"API caída"')
    expect(html).toContain('"invitations":[]')
  })
})
