// Types mirroring the backend /api/v1/parametros-producto and lote history shapes.

// Recommended parameters bound to a product (GET /api/v1/parametros-producto).
export interface ParametroProducto {
  id: string
  productoId: string
  productoNombre: string
  pesoReferenciaKg: number
  toleranciaPesoPct: number
  dimensionBaseCm: number
  toleranciaDimensionCm: number
  tempMin: number
  tempMax: number
  velocidadCintaMin: number
  velocidadCintaMax: number
  activo: boolean
  createdAt: string
  updatedAt: string
}

// Request body for PUT/POST /api/v1/parametros-producto (full replacement).
export interface ParametroProductoRequest {
  productoId: string
  pesoReferenciaKg: number
  toleranciaPesoPct: number
  dimensionBaseCm: number
  toleranciaDimensionCm: number
  tempMin: number
  tempMax: number
  velocidadCintaMin: number
  velocidadCintaMax: number
}

// A single batch run used by the per-product history. Horno/cinta fields are
// nullable (the Go backend marshals nil *float64 as null).
export interface LoteProductivo {
  id: string
  productoId: string
  productoNombre: string
  turno: "mañana" | "tarde" | "noche"
  inicioAt: string
  finAt?: string
  tempHorno1: number | null
  tempCombHorno1: number | null
  tempHorno2: number | null
  tempCombHorno2: number | null
  velocidadCinta: number | null
}

export interface LotesPorProducto {
  items: LoteProductivo[]
  total: number
  page: number
  pageSize: number
}

// Mirrors the backend `ParametroProductoRequest.Validate()` so the form can
// surface the same errors before submitting. Returns a map keyed by field.
export type ParametroProductoErrores = Partial<
  Record<keyof ParametroProductoRequest, string>
>

export function validateParametros(
  values: ParametroProductoRequest,
): ParametroProductoErrores {
  const errors: ParametroProductoErrores = {}

  if (!values.productoId) {
    errors.productoId = "Seleccioná un producto."
  }
  if (!(values.pesoReferenciaKg > 0)) {
    errors.pesoReferenciaKg = "Debe ser mayor a 0."
  }
  if (!(values.toleranciaPesoPct >= 0)) {
    errors.toleranciaPesoPct = "Debe ser mayor o igual a 0."
  }
  if (!(values.dimensionBaseCm > 0)) {
    errors.dimensionBaseCm = "Debe ser mayor a 0."
  }
  if (!(values.toleranciaDimensionCm >= 0)) {
    errors.toleranciaDimensionCm = "Debe ser mayor o igual a 0."
  }
  if (!(values.tempMax > values.tempMin)) {
    errors.tempMax = "Debe ser mayor a la temperatura mínima."
  }
  if (!(values.velocidadCintaMax > values.velocidadCintaMin)) {
    errors.velocidadCintaMax = "Debe ser mayor a la velocidad mínima."
  }

  return errors
}
