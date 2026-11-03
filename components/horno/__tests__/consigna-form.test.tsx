// @vitest-environment jsdom

import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Producto } from "@/lib/production-data"
import { ConsignaPanel } from "@/components/horno/consigna-panel"

const mocks = vi.hoisted(() => ({
  enviarConsignaManual: vi.fn(),
  getConsignaHistorial: vi.fn(),
}))

vi.mock("@/actions/api", () => ({
  enviarConsignaManual: mocks.enviarConsignaManual,
  getConsignaHistorial: mocks.getConsignaHistorial,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock("@/components/horno/consigna-historial", () => ({
  ConsignaHistorial: () => null,
}))

vi.mock("@/components/horno/horno-estado-card", () => ({
  HornoEstadoCard: () => null,
}))

const producto: Producto = {
  id: "p-1",
  nombre: "Pan",
  activo: true,
  pesoReferenciaKg: 0.5,
  toleranciaPesoPct: 5,
  dimensionBaseCm: 10,
  toleranciaDimensionCm: 1,
  tempMin: 180,
  tempMax: 240,
  velocidadCintaMin: 1,
  velocidadCintaMax: 2,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getConsignaHistorial.mockResolvedValue([])
})

function renderPanel(overrides: {
  modo: "MANUAL" | "SUPERVISION" | "AUTOMATICO"
  loteId?: string
}) {
  return render(
    <ConsignaPanel
      hornoId="horno-01"
      productos={[producto]}
      loteOptions={[{ id: "l-1", label: "Pan · Sector 1", modo: overrides.modo }]}
      initialLoteId={overrides.loteId ?? "l-1"}
      initialHistorial={[]}
      hornoEstado={null}
    />,
  )
}

describe("ConsignaForm · bloqueo por modo del lote", () => {
  it("bloquea el formulario cuando el lote está en SUPERVISION", () => {
    renderPanel({ modo: "SUPERVISION" })

    expect(screen.getByRole("alert").textContent).toContain("Consigna manual bloqueada")
    expect(
      (screen.getByLabelText("Temperatura objetivo") as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByLabelText("Velocidad de cinta objetivo") as HTMLInputElement).disabled,
    ).toBe(true)
    expect((screen.getByRole("button", { name: "Enviar consigna" }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    // El selector de lote sigue habilitado para poder elegir uno en MANUAL.
    expect((screen.getByLabelText("Lote") as HTMLSelectElement).disabled).toBe(false)
  })

  it("bloquea el formulario cuando el lote está en AUTOMATICO", () => {
    renderPanel({ modo: "AUTOMATICO" })

    expect(screen.getByRole("alert").textContent).toContain("Consigna manual bloqueada")
    expect(
      (screen.getByLabelText("Temperatura objetivo") as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByLabelText("Velocidad de cinta objetivo") as HTMLInputElement).disabled,
    ).toBe(true)
    expect((screen.getByRole("button", { name: "Enviar consigna" }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect((screen.getByLabelText("Lote") as HTMLSelectElement).disabled).toBe(false)
  })

  it("habilita el formulario cuando el lote está en MANUAL", () => {
    renderPanel({ modo: "MANUAL" })

    expect(screen.queryByRole("alert")).toBeNull()
    expect(
      (screen.getByLabelText("Temperatura objetivo") as HTMLInputElement).disabled,
    ).toBe(false)
    expect(
      (screen.getByLabelText("Velocidad de cinta objetivo") as HTMLInputElement).disabled,
    ).toBe(false)
    expect((screen.getByRole("button", { name: "Enviar consigna" }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it("bloquea «Sin lote» si hay un lote abierto en AUTOMATICO", () => {
    renderPanel({ modo: "AUTOMATICO", loteId: "" })

    expect(screen.getByRole("alert").textContent).toContain("Consigna manual bloqueada")
    expect(screen.getByRole("alert").textContent).toContain(
      "Hay un lote abierto en modo SUPERVISION o AUTOMATICO",
    )
  })
})
