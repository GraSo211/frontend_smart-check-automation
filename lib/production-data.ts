// Type definition mirroring the API response shape for a production run record.
export interface ProductionRun {
  id: string
  productoId: string
  productoNombre: string
  turno: "mañana" | "tarde" | "noche"
  inicioAt: string
  finAt: string
  totalUnidades: number
  correctos: number
  quemados: number
  crudas: number | null
  correctosKg: number
  quemadosKg: number
  crudosKg: number | null
  tempHorno1: number
  tempCombHorno1: number
  tempHorno2: number
  tempCombHorno2: number
  velocidadCinta: number
  createdAt: string
  updatedAt: string
}

export interface ProductionResponse {
  success: boolean
  message: string
  data: ProductionRun[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
