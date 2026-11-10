import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { UserManagement } from "@/components/user-management"

vi.mock("@/actions/users", () => ({
  createUserAction: vi.fn(),
  getUsersAction: vi.fn(),
  updateUserAction: vi.fn(),
}))

const user = {
  id: "u1",
  nombre: "Ana",
  email: "ana@test",
  rol: "Operario" as const,
  activo: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
}

describe("UserManagement real", () => {
  it("muestra estado no disponible y no un vacío cuando falla la carga", () => {
    const html = renderToStaticMarkup(React.createElement(UserManagement, { initialUsers: [user], initialError: "API caída" }))
    expect(html).toContain("Usuarios no disponibles")
    expect(html).not.toContain("Sin usuarios")
    expect(html).not.toContain("Sin resultados")
    expect(html).not.toContain("No hay usuarios")
    expect(html).not.toContain("Ana")
  })

  it("muestra vacío válido separado de una búsqueda sin coincidencias", () => {
    const html = renderToStaticMarkup(React.createElement(UserManagement, { initialUsers: [] }))
    expect(html).toContain("Sin usuarios")
    expect(html).toContain("No hay usuarios para mostrar.")
  })
})
