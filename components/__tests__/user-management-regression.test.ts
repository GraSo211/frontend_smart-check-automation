import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { applyUserPatch, createUserOperationTracker, filterUsersBySearch } from "@/lib/user-management-state"
import type { UserDTO } from "@/actions/users"

const getUsersAction = vi.hoisted(() => vi.fn())

vi.mock("@/actions/users", () => ({ getUsersAction }))
vi.mock("@/components/user-management", () => ({
  UserManagement: (props: Record<string, unknown>) =>
    React.createElement("pre", null, JSON.stringify(props)),
}))

function output(element: React.ReactElement) {
  return renderToStaticMarkup(element).replaceAll("&quot;", '"')
}

describe("carga de usuarios", () => {
  it("distingue respuesta fallida de un listado vacío válido", async () => {
    const { default: Page } = await import("@/app/(modulos)/usuarios/page")

    getUsersAction.mockResolvedValueOnce({ ok: false, message: "Permiso insuficiente" })
    expect(output(await Page())).toContain('"initialError":"Permiso insuficiente"')

    getUsersAction.mockResolvedValueOnce({ ok: true, users: [] })
    const empty = output(await Page())
    expect(empty).toContain('"initialError":null')
    expect(empty).not.toContain("Permiso insuficiente")
  })
})

describe("operaciones concurrentes por usuario", () => {
  it("aplica promesas diferidas en orden inverso sin perder patches", async () => {
    const tracker = createUserOperationTracker()
    const users: UserDTO[] = [
      { id: "u1", nombre: "Uno", email: "uno@test", rol: "Operario" as const, activo: true, createdAt: "", updatedAt: "" },
      { id: "u2", nombre: "Dos", email: "dos@test", rol: "Operario" as const, activo: true, createdAt: "", updatedAt: "" },
    ]
    let current = users
    let resolveU1!: () => void
    let resolveU2!: () => void
    const u1Request = new Promise<void>((resolve) => { resolveU1 = resolve })
    const u2Request = new Promise<void>((resolve) => { resolveU2 = resolve })
    expect(tracker.begin("u1")).toBe(true)
    expect(tracker.begin("u1")).toBe(false)
    expect(tracker.begin("u2")).toBe(true)
    expect(tracker.has("u2")).toBe(true)
    resolveU2()
    await u2Request.then(() => {
      current = applyUserPatch(current, "u2", { rol: "Supervisor" })
      tracker.end("u2")
    })
    expect(current.find((user) => user.id === "u2")?.rol).toBe("Supervisor")
    expect(tracker.has("u1")).toBe(true)
    resolveU1()
    await u1Request.then(() => {
      current = applyUserPatch(current, "u1", { activo: false })
      tracker.end("u1")
    })
    expect(current.find((user) => user.id === "u1")?.activo).toBe(false)
    expect(tracker.has("u1")).toBe(false)
    tracker.end("u2")
    expect(tracker.snapshot().size).toBe(0)
  })

  it("distingue búsqueda sin coincidencias sin convertirla en error", () => {
    const users = [{ id: "u1", nombre: "Ana", email: "ana@test", rol: "Operario" as const, activo: true, createdAt: "", updatedAt: "" }]
    expect(filterUsersBySearch(users, "inexistente")).toHaveLength(0)
  })
})
