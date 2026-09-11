import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => React.createElement("img", props) }))
vi.mock("@/components/monitoring-provider", () => ({
  useMonitoring: () => ({
    sync: {
      lotes: { lastQueryAt: "2026-01-01T10:00:00Z", lastDataEventAt: null, lastConfirmedAt: "2026-01-01T09:00:00Z", freshness: "stale" },
      nodos: { lastQueryAt: null, lastDataEventAt: null, lastConfirmedAt: null, freshness: "never" },
    },
  }),
}))

import { Footer } from "@/components/layout/footer"

describe("sync por fuente en footer", () => {
  it("separa lotes desactualizados de nodos sin confirmación", () => {
    const html = renderToStaticMarkup(React.createElement(Footer))
    expect(html).toContain("Lotes:")
    expect(html).toContain("Desactualizada")
    expect(html).toContain("Nodos:")
    expect(html).toContain("Sin confirmar")
    expect(html).toContain("Consulta o evento válido recibido")
  })
})
