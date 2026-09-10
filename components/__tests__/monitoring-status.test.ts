import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MonitoringStatus, availabilityLabel } from "@/components/layout/monitoring-status"
import type { Availability } from "@/lib/monitoring-types"

const status = (availability: Availability) => ({
  availability,
  checkedAt: null,
  detail: availability === "unknown" ? "Sin comprobación" : "Estado comprobado",
})

describe("estado de monitoreo", () => {
  it("mapea las cuatro disponibilidades con copy explícito", () => {
    const availabilities: Availability[] = ["available", "degraded", "disconnected", "unknown"]
    expect(availabilities.map(availabilityLabel)).toEqual([
      "Disponible", "Degradado", "Desconectado", "Desconocido",
    ])
  })

  it("no presenta un estado global saludable cuando una fuente es desconocida", () => {
    const html = renderToStaticMarkup(React.createElement(MonitoringStatus, { label: "Monitoreo", status: status("unknown") }))
    expect(html).toContain("Desconocido")
    expect(html).not.toContain("Todos los sistemas")
    expect(html).not.toContain("Funcionando")
  })
})
