// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Consigna, Producto } from "@/lib/production-data"
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
  ConsignaHistorial: ({ consignas }: { consignas: Consigna[] }) => (
    <div data-testid="historial">{consignas.map((c) => c.id).join(",")}</div>
  ),
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
  loteOptions?: { id: string; label: string; modo?: "MANUAL" | "SUPERVISION" | "AUTOMATICO" }[]
}) {
  return render(
    <ConsignaPanel
      hornoId="horno-01"
      productos={[producto]}
      loteOptions={
        overrides.loteOptions ?? [{ id: "l-1", label: "Pan · Sector 1", modo: overrides.modo }]
      }
      initialLoteId={overrides.loteId ?? "l-1"}
      initialHistorial={[]}
      hornoEstado={null}
    />,
  )
}

function consigna(id: string): Consigna {
  return {
    id,
    hornoId: "horno-01",
    temperaturaObjetivo: 200,
    velocidadCintaObjetivo: 1.5,
    origen: "MANUAL",
    exitosa: true,
    creadaEn: "2026-01-01T10:00:00Z",
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("ConsignaPanel · historial", () => {
  it("no deja que la respuesta de un lote viejo pise el historial del lote actual", async () => {
    const loteA = deferred<Consigna[]>()
    const loteB = deferred<Consigna[]>()
    mocks.getConsignaHistorial.mockImplementation((id: string) =>
      id === "l-a" ? loteA.promise : loteB.promise,
    )

    renderPanel({
      modo: "MANUAL",
      loteId: "",
      loteOptions: [
        { id: "l-a", label: "Lote A", modo: "MANUAL" },
        { id: "l-b", label: "Lote B", modo: "MANUAL" },
      ],
    })

    const selector = screen.getByLabelText("Lote") as HTMLSelectElement

    fireEvent.change(selector, { target: { value: "l-a" } })
    expect(screen.getByText("Actualizando historial…")).toBeTruthy()

    fireEvent.change(selector, { target: { value: "l-b" } })

    await act(async () => loteB.resolve([consigna("b-1")]))
    expect(screen.getByTestId("historial").textContent).toBe("b-1")
    expect(screen.queryByText("Actualizando historial…")).toBeNull()

    await act(async () => loteA.resolve([consigna("a-1")]))
    expect(screen.getByTestId("historial").textContent).toBe("b-1")
    expect(screen.queryByText("Actualizando historial…")).toBeNull()
  })
})

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
