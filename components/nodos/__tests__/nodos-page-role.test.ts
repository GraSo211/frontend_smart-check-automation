import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDevices: vi.fn(),
  getRegistrationRequests: vi.fn(),
}))

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, getSession: mocks.getSession }
})
vi.mock("@/actions/api", () => ({
  getDevices: mocks.getDevices,
  getRegistrationRequests: mocks.getRegistrationRequests,
}))
vi.mock("@/components/nodos/devices-state", () => ({
  default: (props: Record<string, unknown>) => React.createElement("pre", null, JSON.stringify(props)),
}))

function output(element: React.ReactElement) {
  return renderToStaticMarkup(element).replaceAll("&quot;", '"')
}

describe("gating de rol en la página de nodos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDevices.mockResolvedValue([])
    mocks.getRegistrationRequests.mockResolvedValue([])
  })

  it("carga las solicitudes y habilita la gestión a un Supervisor", async () => {
    mocks.getSession.mockResolvedValue({ email: "s@test", nombre: "Sup", rol: "Supervisor" })
    const { default: Page } = await import("@/app/(modulos)/nodos/page")

    const html = output(await Page())
    expect(mocks.getRegistrationRequests).toHaveBeenCalledTimes(1)
    expect(html).not.toContain("Sólo lectura")
    expect(html).toContain('"canManage":true')
    expect(html).toContain('"registrationRequests":[]')
    expect(html).toContain('"registrationRequestsError":null')
  })

  it("deja a un Operario en sólo lectura y sin pedir las solicitudes", async () => {
    mocks.getSession.mockResolvedValue({ email: "o@test", nombre: "Op", rol: "Operario" })
    const { default: Page } = await import("@/app/(modulos)/nodos/page")

    const html = output(await Page())
    expect(mocks.getRegistrationRequests).not.toHaveBeenCalled()
    expect(html).toContain("Sólo lectura")
    expect(html).toContain('"canManage":false')
  })

  it("distingue el error de solicitudes de un listado vacío", async () => {
    mocks.getSession.mockResolvedValue({ email: "s@test", nombre: "Sup", rol: "Supervisor" })
    mocks.getRegistrationRequests.mockRejectedValueOnce(new Error("API caída"))
    const { default: Page } = await import("@/app/(modulos)/nodos/page")

    const html = output(await Page())
    expect(html).toContain('"registrationRequestsError":"API caída"')
    expect(html).toContain('"registrationRequests":[]')
  })
})
