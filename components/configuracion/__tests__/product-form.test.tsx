// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { toRequest } from "@/components/configuracion/product-form"

function values(overrides: Partial<Parameters<typeof toRequest>[0]> = {}): Parameters<typeof toRequest>[0] {
  return {
    nombre: "Pan",
    costoFabricacionUnitarioArs: "",
    pesoReferenciaKg: "0.5",
    toleranciaPesoPct: "5",
    dimensionBaseCm: "10",
    toleranciaDimensionCm: "1",
    tempMin: "180",
    tempMax: "220",
    velocidadCintaMin: "0.5",
    velocidadCintaMax: "1.5",
    capacidadNominalKgH: "",
    tempSetpoint: "",
    velocidadCintaSetpoint: "",
    ...overrides,
  }
}

describe("toRequest: capacidad nominal", () => {
  it("manda null cuando el campo queda vacío", () => {
    expect(toRequest(values()).capacidadNominalKgH).toBeNull()
    expect(toRequest(values({ capacidadNominalKgH: "  " })).capacidadNominalKgH).toBeNull()
  })

  it("manda el número cuando se completa", () => {
    expect(toRequest(values({ capacidadNominalKgH: "120" })).capacidadNominalKgH).toBe(120)
  })
})

describe("toRequest: costo unitario", () => {
  it("envía null explícito para quitar el costo, y conserva cero y centavos", () => {
    expect(toRequest(values()).costoFabricacionUnitarioArs).toBeNull()
    expect(toRequest(values({ costoFabricacionUnitarioArs: "0" })).costoFabricacionUnitarioArs).toBe(0)
    expect(toRequest(values({ costoFabricacionUnitarioArs: "125.50" })).costoFabricacionUnitarioArs).toBe(125.5)
  })
})
