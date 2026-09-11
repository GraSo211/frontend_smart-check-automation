import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
import { ParametersHistory } from "@/components/configuracion/parameters-history"

describe("ParametersHistory paginación remota", () => {
  it("conserva el total backend y permite una página posterior a 100", () => {
    const row = { id: "l-101", productoId: "p-1", productoNombre: "Producto", turno: "mañana" as const, inicioAt: "2026-01-01T00:00:00Z", tempHorno1: 180, tempCombHorno1: 1, tempHorno2: 180, tempCombHorno2: 1, velocidadCinta: 1 }
    const html = renderToStaticMarkup(React.createElement(ParametersHistory, { lotes: Array.from({ length: 10 }, () => row), productoId: "p-1", productoNombre: "Producto", total: 101, page: 11, pageSize: 10 }))
    expect(html).toContain("101 corridas")
    expect(html).toContain("Página 11 de 11")
    expect(html).toContain("chevrons-right")
  })
})
