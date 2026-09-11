import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ConnectionIndicator } from "@/components/shared/connection-indicator"

describe("ConnectionIndicator", () => {
  it.each([["connected", "Conectado"], ["reconnecting", "Reconectando"], ["disconnected", "Desconectado"], ["unknown", "Sin información"]] as const)("muestra %s", (state, label) => {
    expect(renderToStaticMarkup(React.createElement(ConnectionIndicator, { state, label: "Nodos" }))).toContain(label)
  })
  it("ofrece reintento y advierte datos desactualizados", () => {
    const retry = vi.fn()
    const html = renderToStaticMarkup(React.createElement(ConnectionIndicator, { state: "disconnected", onRetry: retry, label: "Lotes" }))
    expect(html).toContain("Reintentar")
    expect(html).toContain("desactualizados")
  })
})
