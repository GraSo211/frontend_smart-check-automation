import { describe, expect, it } from "vitest"
import { validateProducto, type ProductoRequest } from "@/lib/production-data"

function request(overrides: Partial<ProductoRequest> = {}): ProductoRequest {
  return {
    nombre: "Pan",
    pesoReferenciaKg: 0.5,
    tempMin: 180,
    tempMax: 220,
    velocidadCintaMin: 0.5,
    velocidadCintaMax: 1.5,
    ...overrides,
  }
}

describe("validateProducto: capacidad nominal", () => {
  it("acepta la capacidad ausente o null", () => {
    expect(validateProducto(request()).capacidadNominalKgH).toBeUndefined()
    expect(validateProducto(request({ capacidadNominalKgH: null })).capacidadNominalKgH).toBeUndefined()
  })

  it("acepta una capacidad positiva", () => {
    expect(validateProducto(request({ capacidadNominalKgH: 120 })).capacidadNominalKgH).toBeUndefined()
  })

  it("rechaza 0 y negativos", () => {
    expect(validateProducto(request({ capacidadNominalKgH: 0 })).capacidadNominalKgH).toBe(
      "Debe ser mayor a 0.",
    )
    expect(validateProducto(request({ capacidadNominalKgH: -5 })).capacidadNominalKgH).toBe(
      "Debe ser mayor a 0.",
    )
  })
})

describe("validateProducto: costo de fabricación", () => {
  it.each([undefined, null, 0, 0.1, 125.50, 9999999999.99])("acepta %s", (costoFabricacionUnitarioArs) => {
    expect(validateProducto(request({ costoFabricacionUnitarioArs })).costoFabricacionUnitarioArs).toBeUndefined()
  })
  it.each([-1, 0.001, 10000000000, Number.NaN, Infinity])("rechaza %s", (costoFabricacionUnitarioArs) => {
    expect(validateProducto(request({ costoFabricacionUnitarioArs })).costoFabricacionUnitarioArs).toBeDefined()
  })
})
