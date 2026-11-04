import { describe, expect, it } from "vitest"
import { validateConsignaInput, type Producto } from "@/lib/production-data"

function productoBase(overrides?: Partial<Producto>): Producto {
  return {
    id: "prod-1",
    nombre: "Baguette",
    activo: true,
    pesoReferenciaKg: 0.25,
    toleranciaPesoPct: 5,
    dimensionBaseCm: 30,
    toleranciaDimensionCm: 1,
    tempMin: 160,
    tempMax: 180,
    velocidadCintaMin: 0.1,
    velocidadCintaMax: 0.3,
    capacidadNominalKgH: null,
    ...overrides,
  }
}

describe("validateConsignaInput", () => {
  it("acepta valores dentro del rango del producto", () => {
    const errors = validateConsignaInput(productoBase(), {
      temperaturaObjetivo: 170,
      velocidadCintaObjetivo: 0.2,
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it("acepta los límites inferior y superior", () => {
    const errors = validateConsignaInput(productoBase(), {
      temperaturaObjetivo: 160,
      velocidadCintaObjetivo: 0.3,
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it("rechaza temperatura por debajo del mínimo", () => {
    const errors = validateConsignaInput(productoBase(), {
      temperaturaObjetivo: 150,
      velocidadCintaObjetivo: 0.2,
    })
    expect(errors.temperaturaObjetivo).toContain("160")
    expect(errors.temperaturaObjetivo).toContain("180")
    expect(errors.velocidadCintaObjetivo).toBeUndefined()
  })

  it("rechaza velocidad por encima del máximo", () => {
    const errors = validateConsignaInput(productoBase(), {
      temperaturaObjetivo: 170,
      velocidadCintaObjetivo: 0.5,
    })
    expect(errors.velocidadCintaObjetivo).toContain("0.1")
    expect(errors.velocidadCintaObjetivo).toContain("0.3")
    expect(errors.temperaturaObjetivo).toBeUndefined()
  })

  it("rechaza valores no numéricos", () => {
    const errors = validateConsignaInput(productoBase(), {
      temperaturaObjetivo: "",
      velocidadCintaObjetivo: "abc",
    })
    expect(errors.temperaturaObjetivo).toBe("Ingresá un número.")
    expect(errors.velocidadCintaObjetivo).toBe("Ingresá un número.")
  })

  it("acepta strings numéricos válidos", () => {
    const errors = validateConsignaInput(productoBase(), {
      temperaturaObjetivo: "175.5",
      velocidadCintaObjetivo: "0.15",
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})
