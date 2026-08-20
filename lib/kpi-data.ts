import type { ProductionRun } from "@/lib/production-data"
import { PARAMETROS_PRODUCTOS_MOCK, type ParametroProducto } from "@/lib/parametros-producto"
import type { DesgloseProductoKPI, KPIFinancieroData, KPIFinancieroFilters } from "@/types/kpi"

// Product cost lookup mapping product name / ID to unit cost in ARS
export const PRODUCT_COSTS_FALLBACK: Record<string, number | null> = {
  "Tostada Integral": 390.0,
  "Pan Francés": 450.0,
  "Pan de Molde": 520.0,
  "Galleta de Avena": 280.0,
  "Croissant Mantequilla": 650.0,
  "Pan Ciabatta": 480.0,
  "Pan Centeno": 410.0,
  "Bizcocho de Vainilla": null, // Costo no configurado intencionalmente
}

export function calculateKPIFinancieroMock(
  runs: ProductionRun[],
  productos: ParametroProducto[] = PARAMETROS_PRODUCTOS_MOCK,
  filters?: KPIFinancieroFilters,
): KPIFinancieroData {
  let filtered = [...runs]

  if (filters?.turno && filters.turno !== "todos") {
    filtered = filtered.filter((r) => r.turno === filters.turno)
  }

  if (filters?.productoId) {
    filtered = filtered.filter((r) => r.productoId === filters.productoId)
  }

  if (filters?.desde) {
    const fromDate = new Date(filters.desde).getTime()
    filtered = filtered.filter((r) => new Date(r.inicioAt).getTime() >= fromDate)
  }

  if (filters?.hasta) {
    const toDate = new Date(filters.hasta).getTime()
    filtered = filtered.filter((r) => new Date(r.inicioAt).getTime() <= toDate)
  }

  // Group runs by product name / id
  const productRunsMap = new Map<string, ProductionRun[]>()
  for (const run of filtered) {
    const groupKey = run.productoNombre
    const list = productRunsMap.get(groupKey) ?? []
    list.push(run)
    productRunsMap.set(groupKey, list)
  }

  const desgloseProductos: DesgloseProductoKPI[] = []

  // Ensure all products present in runs are processed
  for (const [productoNombre, runsOfProduct] of productRunsMap.entries()) {
    const matchedParam = productos.find(
      (p) => p.productoNombre.toLowerCase() === productoNombre.toLowerCase(),
    )

    // Lookup unit cost: prioritize matchedParam.costoUnitario, then fallback mapping
    const rawCost =
      matchedParam?.costoUnitario !== undefined
        ? matchedParam.costoUnitario
        : PRODUCT_COSTS_FALLBACK[productoNombre] ?? null

    const hasCost = rawCost !== null && rawCost !== undefined && rawCost > 0
    const unitCost = hasCost ? Number(rawCost) : null

    const totalMermas = runsOfProduct.reduce(
      (acc, r) => acc + r.quemados + (r.crudas ?? 0),
      0,
    )
    const lotesTotales = runsOfProduct.length
    const lotesSinCosto = hasCost ? 0 : lotesTotales
    const impacto = hasCost && unitCost ? totalMermas * unitCost : 0

    const productoId =
      matchedParam?.productoId ??
      runsOfProduct[0]?.productoId ??
      `mock-prod-${productoNombre.toLowerCase().replace(/\s+/g, "-")}`

    desgloseProductos.push({
      productoId,
      productoNombre,
      totalMermasUnidades: totalMermas,
      costoUnitarioPromedio: unitCost,
      costoConfiguradoVigente: unitCost,
      impactoEconomico: Math.round(impacto * 100) / 100,
      tieneCostoConfigurado: hasCost,
      lotesTotales,
      lotesSinCosto,
    })
  }

  // Sort products with missing cost first, then by highest economic impact
  desgloseProductos.sort((a, b) => {
    if (!a.tieneCostoConfigurado && b.tieneCostoConfigurado) return -1
    if (a.tieneCostoConfigurado && !b.tieneCostoConfigurado) return 1
    return b.impactoEconomico - a.impactoEconomico
  })

  const totalMermasUnidades = desgloseProductos.reduce(
    (acc, p) => acc + p.totalMermasUnidades,
    0,
  )
  const totalMermasConCosto = desgloseProductos
    .filter((p) => p.tieneCostoConfigurado)
    .reduce((acc, p) => acc + p.totalMermasUnidades, 0)
  const totalMermasSinCosto = totalMermasUnidades - totalMermasConCosto

  const totalImpactoEconomico = desgloseProductos.reduce(
    (acc, p) => acc + p.impactoEconomico,
    0,
  )

  const lotesSinCosto = desgloseProductos
    .filter((p) => !p.tieneCostoConfigurado)
    .reduce((acc, p) => acc + p.lotesTotales, 0)

  const productosSinCosto = desgloseProductos.filter(
    (p) => !p.tieneCostoConfigurado && p.totalMermasUnidades > 0,
  )
  const productosSinCostoCount = productosSinCosto.length
  const tieneCostosFaltantes = productosSinCostoCount > 0

  const advertencia = tieneCostosFaltantes
    ? `Cálculo parcial: hay ${productosSinCostoCount} ${
        productosSinCostoCount === 1 ? "producto" : "productos"
      } con costo no configurado`
    : ""

  return {
    totalImpactoEconomico: Math.round(totalImpactoEconomico * 100) / 100,
    moneda: "ARS",
    totalMermasUnidades,
    totalMermasConCosto,
    totalMermasSinCosto,
    totalLotes: filtered.length,
    lotesSinCosto,
    totalProductos: desgloseProductos.length,
    productosSinCostoCount,
    tieneCostosFaltantes,
    advertencia,
    desgloseProductos,
    calculadoAt: new Date().toISOString(),
  }
}
