import { describe, it, expect } from "vitest"
import { calculateKPIFinancieroMock } from "@/lib/kpi-data"
import type { ProductionRun } from "@/lib/production-data"
import type { ParametroProducto } from "@/lib/parametros-producto"

const mockProductsWithCosts: ParametroProducto[] = [
  {
    id: "param-1",
    productoId: "prod-1",
    productoNombre: "Pan Lactal",
    pesoReferenciaKg: 0.5,
    toleranciaPesoPct: 5,
    dimensionBaseCm: 25,
    toleranciaDimensionCm: 1,
    tempMin: 180,
    tempMax: 200,
    velocidadCintaMin: 0.1,
    velocidadCintaMax: 0.3,
    costoUnitario: 420.0,
    activo: true,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "param-2",
    productoId: "prod-2",
    productoNombre: "Tostada Integral",
    pesoReferenciaKg: 0.03,
    toleranciaPesoPct: 10,
    dimensionBaseCm: 8,
    toleranciaDimensionCm: 0.5,
    tempMin: 160,
    tempMax: 180,
    velocidadCintaMin: 0.1,
    velocidadCintaMax: 0.3,
    costoUnitario: 390.0,
    activo: true,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
]

const mockRunsComplete: ProductionRun[] = [
  {
    id: "run-1",
    productoId: "prod-1",
    productoNombre: "Pan Lactal",
    turno: "mañana",
    inicioAt: "2026-08-10T06:00:00Z",
    finAt: "2026-08-10T08:00:00Z",
    totalUnidades: 1000,
    correctos: 900,
    quemados: 80,
    crudas: 20, // Total mermas = 100
    correctosKg: 450,
    quemadosKg: 40,
    crudosKg: 10,
    tempHorno1: 190,
    tempCombHorno1: 180,
    tempHorno2: 195,
    tempCombHorno2: 185,
    velocidadCinta: 0.2,
    createdAt: "2026-08-10T06:00:00Z",
    updatedAt: "2026-08-10T08:00:00Z",
  },
  {
    id: "run-2",
    productoId: "prod-2",
    productoNombre: "Tostada Integral",
    turno: "tarde",
    inicioAt: "2026-08-10T14:00:00Z",
    finAt: "2026-08-10T16:00:00Z",
    totalUnidades: 2000,
    correctos: 1950,
    quemados: 50,
    crudas: null, // Total mermas = 50
    correctosKg: 60,
    quemadosKg: 1.5,
    crudosKg: null,
    tempHorno1: 170,
    tempCombHorno1: 160,
    tempHorno2: 175,
    tempCombHorno2: 165,
    velocidadCinta: 0.25,
    createdAt: "2026-08-10T14:00:00Z",
    updatedAt: "2026-08-10T16:00:00Z",
  },
]

describe("calculateKPIFinancieroMock", () => {
  it("calculates total economic impact accurately when all products have configured cost (Camino feliz)", () => {
    // Pan Lactal: 100 mermas * $420 = $42,000
    // Tostada Integral: 50 mermas * $390 = $19,500
    // Total = $61,500
    const result = calculateKPIFinancieroMock(mockRunsComplete, mockProductsWithCosts)

    expect(result.moneda).toBe("ARS")
    expect(result.totalImpactoEconomico).toBe(61500)
    expect(result.totalMermasUnidades).toBe(150)
    expect(result.totalMermasConCosto).toBe(150)
    expect(result.totalMermasSinCosto).toBe(0)
    expect(result.tieneCostosFaltantes).toBe(false)
    expect(result.productosSinCostoCount).toBe(0)
    expect(result.advertencia).toBe("")
    expect(result.desgloseProductos).toHaveLength(2)
  })

  it("handles missing product cost by flagging tieneCostosFaltantes and generating warning message", () => {
    const productsWithMissingCost: ParametroProducto[] = [
      ...mockProductsWithCosts,
      {
        id: "param-3",
        productoId: "prod-3",
        productoNombre: "Pan Dulce Especial",
        pesoReferenciaKg: 0.8,
        toleranciaPesoPct: 5,
        dimensionBaseCm: 20,
        toleranciaDimensionCm: 1,
        tempMin: 170,
        tempMax: 190,
        velocidadCintaMin: 0.1,
        velocidadCintaMax: 0.2,
        costoUnitario: null, // Sin costo
        activo: true,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    ]

    const runsWithMissingCost: ProductionRun[] = [
      ...mockRunsComplete,
      {
        id: "run-3",
        productoId: "prod-3",
        productoNombre: "Pan Dulce Especial",
        turno: "noche",
        inicioAt: "2026-08-10T22:00:00Z",
        finAt: "2026-08-11T00:00:00Z",
        totalUnidades: 500,
        correctos: 400,
        quemados: 100,
        crudas: null,
        correctosKg: 320,
        quemadosKg: 80,
        crudosKg: null,
        tempHorno1: 175,
        tempCombHorno1: 165,
        tempHorno2: 180,
        tempCombHorno2: 170,
        velocidadCinta: 0.15,
        createdAt: "2026-08-10T22:00:00Z",
        updatedAt: "2026-08-11T00:00:00Z",
      },
    ]

    const result = calculateKPIFinancieroMock(runsWithMissingCost, productsWithMissingCost)

    expect(result.totalImpactoEconomico).toBe(61500) // Does not add unconfigured product to avoid false low loss
    expect(result.totalMermasUnidades).toBe(250)
    expect(result.totalMermasConCosto).toBe(150)
    expect(result.totalMermasSinCosto).toBe(100)
    expect(result.tieneCostosFaltantes).toBe(true)
    expect(result.productosSinCostoCount).toBe(1)
    expect(result.advertencia).toContain("Cálculo parcial: hay 1 producto con costo no configurado")

    const missingProduct = result.desgloseProductos.find(
      (p) => p.productoNombre === "Pan Dulce Especial",
    )
    expect(missingProduct).toBeDefined()
    expect(missingProduct?.tieneCostoConfigurado).toBe(false)
    expect(missingProduct?.costoUnitarioPromedio).toBeNull()
    expect(missingProduct?.impactoEconomico).toBe(0)
  })

  it("filters runs by turno", () => {
    const result = calculateKPIFinancieroMock(mockRunsComplete, mockProductsWithCosts, {
      turno: "mañana",
    })

    expect(result.totalLotes).toBe(1)
    expect(result.totalMermasUnidades).toBe(100)
    expect(result.totalImpactoEconomico).toBe(42000)
  })

  it("returns zero impact and empty breakdowns when given empty runs", () => {
    const result = calculateKPIFinancieroMock([], mockProductsWithCosts)

    expect(result.totalImpactoEconomico).toBe(0)
    expect(result.totalMermasUnidades).toBe(0)
    expect(result.totalLotes).toBe(0)
    expect(result.tieneCostosFaltantes).toBe(false)
    expect(result.desgloseProductos).toHaveLength(0)
  })
})
