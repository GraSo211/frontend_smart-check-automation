export interface DesgloseProductoKPI {
  productoId: string
  productoNombre: string
  totalMermasUnidades: number
  costoUnitarioPromedio: number | null
  costoConfiguradoVigente: number | null
  impactoEconomico: number
  tieneCostoConfigurado: boolean
  lotesTotales: number
  lotesSinCosto: number
}

export interface KPIFinancieroData {
  totalImpactoEconomico: number
  moneda: string // Siempre "ARS"
  totalMermasUnidades: number
  totalMermasConCosto: number
  totalMermasSinCosto: number
  totalLotes: number
  lotesSinCosto: number
  totalProductos: number
  productosSinCostoCount: number
  tieneCostosFaltantes: boolean
  advertencia?: string
  desgloseProductos: DesgloseProductoKPI[]
  calculadoAt: string
}

export interface KPIFinancieroResponse {
  success: boolean
  message?: string
  data: KPIFinancieroData
  errors?: string | string[] | null
}

export interface KPIFinancieroFilters {
  desde?: string
  hasta?: string
  productoId?: string
  turno?: "mañana" | "tarde" | "noche" | "todos"
}
