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

export type Producto = {
  id: string
  nombre: string
  activo: boolean
}
