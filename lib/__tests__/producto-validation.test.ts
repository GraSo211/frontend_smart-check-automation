import { describe, expect, it } from "vitest"
import { validateProducto, type ProductoRequest } from "@/lib/production-data"

function request(overrides: Partial<ProductoRequest> = {}): ProductoRequest {
  return {
    nombre: "Pan",
    pesoReferenciaKg: 0.5,
    toleranciaPesoPct: 5,
    dimensionBaseCm: 10,
    toleranciaDimensionCm: 1,
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
