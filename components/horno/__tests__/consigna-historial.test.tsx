// @vitest-environment jsdom

import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ConsignaHistorial } from "@/components/horno/consigna-historial"
import type { Consigna } from "@/lib/production-data"

function buildConsigna(overrides: Partial<Omit<Consigna, "id">> & { id: string }): Consigna {
  return {
    hornoId: "horno-1",
    loteId: "lote-1",
    temperaturaObjetivo: 200,
    velocidadCintaObjetivo: 1.5,
    origen: "MANUAL",
    usuario: "op-1",
    exitosa: true,
    creadaEn: "2026-01-01T10:00:00Z",
    ...overrides,
    id: overrides.id,
  }
}

describe("ConsignaHistorial", () => {
  it("muestra Aplicada cuando el estado es APLICADA", () => {
    render(
      <ConsignaHistorial
        loteId="lote-1"
        consignas={[
          buildConsigna({ id: "c-1", estado: "APLICADA", decisionId: "dddddddd-1111-2222-3333-444444444444" }),
        ]}
      />,
    )
    expect(screen.getByText("Aplicada")).toBeTruthy()
    expect(screen.getByTestId("decision-id-chip").textContent).toBe("dddddddd")
    expect(screen.getByTitle("dddddddd-1111-2222-3333-444444444444")).toBeTruthy()
  })

  it("muestra Pendiente cuando el estado es PENDIENTE", () => {
    render(
      <ConsignaHistorial
        loteId="lote-1"
        consignas={[
          buildConsigna({ id: "c-2", estado: "PENDIENTE", decisionId: "eeeeeeee-5555-6666-7777-888888888888" }),
        ]}
      />,
    )
    expect(screen.getByText("Pendiente")).toBeTruthy()
    expect(screen.getByTestId("decision-id-chip").textContent).toBe("eeeeeeee")
    expect(screen.getByTitle("eeeeeeee-5555-6666-7777-888888888888")).toBeTruthy()
  })

  it("muestra Rechazada cuando el estado es RECHAZADA", () => {
    render(
      <ConsignaHistorial
        loteId="lote-1"
        consignas={[
          buildConsigna({
            id: "c-3",
            estado: "RECHAZADA",
            exitosa: false,
            motivoError: "cola llena",
          }),
        ]}
      />,
    )
    expect(screen.getByText("Rechazada")).toBeTruthy()
    expect(screen.getByText("cola llena")).toBeTruthy()
  })

  it("sin estado usa exitosa como fallback", () => {
    render(
      <ConsignaHistorial
        loteId="lote-1"
        consignas={[
          buildConsigna({ id: "c-4", estado: undefined, exitosa: true }),
          buildConsigna({ id: "c-5", estado: undefined, exitosa: false, motivoError: "timeout" }),
        ]}
      />,
    )
    expect(screen.getByText("Enviada")).toBeTruthy()
    expect(screen.getAllByText("Rechazada").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("timeout")).toBeTruthy()
  })

  it("muestra — cuando no hay decisionId", () => {
    render(
      <ConsignaHistorial
        loteId="lote-1"
        consignas={[buildConsigna({ id: "c-6", estado: "PENDIENTE", decisionId: null })]}
      />,
    )
    expect(screen.getByText("Pendiente")).toBeTruthy()
    expect(screen.getByTestId("decision-id-chip").textContent).toBe("—")
  })

  it("muestra el aviso descriptivo del historial", () => {
    render(<ConsignaHistorial loteId="lote-1" consignas={[]} />)
    expect(
      screen.getByText(
        "Pendiente = encolada para la Pi; Aplicada = confirmada por ack; Rechazada = no se pudo encolar.",
      ),
    ).toBeTruthy()
  })
})
