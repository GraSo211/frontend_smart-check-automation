// Types mirroring the sector/lotes API contract
// (docs/backend-go-lotes-sector.md §4/§8, docs/frontend-migracion-lotes-sector.md §3).

/**
 * Buckets of a lote. A state the model does not produce travels as `null`,
 * never as `0`. `total` is the sum of the non-null buckets.
 */
export type Conteos = {
  ok: number | null
  crudo: number | null
  quemado: number | null
  total: number
}

/**
 * Device that opened the lote. `type` is a free string: the backend emits an
 * empty value when the device has no functional type (`dispositivos.tipo IS
 * NULL` is allowed by the schema). Any value other than `ENTRADA_HORNO`
 * (including `""`) means a degraded lote (§12.2), not an invalid one.
 */
export type AbiertoPor = {
  device_id: string
  type: string
}

export type LoteSector = {
  id: string
  sector_id: string
  estado: "ABIERTO" | "CERRADO"
  producto_id: string
  producto_nombre: string
  abierto_en: string
  abierto_por?: AbiertoPor | null
  conteos: Conteos
  ultimo_evento_en?: string | null
  inactividad_segundos: number
  cerrado_en?: string | null
  motivo_cierre?: string | null
  /**
   * Turno calculado por el backend al abrir el lote ("mañana" | "tarde" |
   * "noche"). Puede faltar (`null`/ausente) en lotes legacy.
   */
  turno?: string | null
}

export type Sector = {
  id: string
  nombre: string
}

/** Body for `POST /api/v1/sectores`. */
export type CreateSectorRequest = {
  nombre: string
}

/** Body for `PUT /api/v1/sectores/{id}`. */
export type UpdateSectorRequest = {
  id: string
  nombre: string
}

// Producto unificado: reúne la identidad del producto con sus parámetros de
// control (antes separados en `parametros_producto` en el backend).
// GET /api/v1/productos devuelve esta entidad completa.
export type Producto = {
  id: string
  nombre: string
  activo: boolean
  pesoReferenciaKg: number
  toleranciaPesoPct: number
  dimensionBaseCm: number
  toleranciaDimensionCm: number
  tempMin: number
  tempMax: number
  velocidadCintaMin: number
  velocidadCintaMax: number
  createdAt?: string
  updatedAt?: string
}

/** Body for `POST /api/v1/productos` and `PUT /api/v1/productos/{id}`. */
export type ProductoRequest = {
  nombre: string
  pesoReferenciaKg: number
  toleranciaPesoPct: number
  dimensionBaseCm: number
  toleranciaDimensionCm: number
  tempMin: number
  tempMax: number
  velocidadCintaMin: number
  velocidadCintaMax: number
}

/** Errores de validación por campo del formulario de producto. */
export type ProductoErrores = Partial<Record<keyof ProductoRequest, string>>

/**
 * Replica las reglas del `ProductoRequest.Validate()` del backend para que el
 * formulario muestre los mismos errores antes de enviar. Devuelve un mapa por
 * campo; vacío cuando el request es válido.
 */
export function validateProducto(values: ProductoRequest): ProductoErrores {
  const errors: ProductoErrores = {}

  const nombre = values.nombre?.trim() ?? ""
  if (!nombre) {
    errors.nombre = "El nombre es obligatorio."
  } else if (nombre.length > 100) {
    errors.nombre = "El nombre no puede superar los 100 caracteres."
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
  if (!Number.isFinite(values.tempMin)) {
    errors.tempMin = "Ingresá un número."
  }
  if (!Number.isFinite(values.tempMax)) {
    errors.tempMax = "Ingresá un número."
  } else if (!(values.tempMax > values.tempMin)) {
    errors.tempMax = "Debe ser mayor a la temperatura mínima."
  }
  if (!Number.isFinite(values.velocidadCintaMin)) {
    errors.velocidadCintaMin = "Ingresá un número."
  }
  if (!Number.isFinite(values.velocidadCintaMax)) {
    errors.velocidadCintaMax = "Ingresá un número."
  } else if (!(values.velocidadCintaMax > values.velocidadCintaMin)) {
    errors.velocidadCintaMax = "Debe ser mayor a la velocidad mínima."
  }

  return errors
}
