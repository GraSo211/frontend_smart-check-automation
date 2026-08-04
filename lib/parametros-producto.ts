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

// ---------- Mock data (fallback when the Render backend is cold) ----------

// Mirrors the backend seed product plus a few extra ones so the selector
// is usable offline.
export const PARAMETROS_PRODUCTOS_MOCK: ParametroProducto[] = [
  {
    id: "de91d67e-a9e1-4b69-a08a-46a965a4b728",
    productoId: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    productoNombre: "Tostada Integral",
    pesoReferenciaKg: 0.03,
    toleranciaPesoPct: 10,
    dimensionBaseCm: 8,
    toleranciaDimensionCm: 0.5,
    tempMin: 160,
    tempMax: 180,
    velocidadCintaMin: 0.1,
    velocidadCintaMax: 0.3,
    activo: true,
    createdAt: "2026-07-23T23:10:05Z",
    updatedAt: "2026-07-23T23:10:05Z",
  },
  {
    id: "1f2e3d4c-5b6a-7988-9a0b-1c2d3e4f5a6b",
    productoId: "b1b2c3d4-5678-90ab-cdef-1234567890ab",
    productoNombre: "Pan Francés",
    pesoReferenciaKg: 0.25,
    toleranciaPesoPct: 8,
    dimensionBaseCm: 45,
    toleranciaDimensionCm: 1,
    tempMin: 200,
    tempMax: 220,
    velocidadCintaMin: 0.15,
    velocidadCintaMax: 0.35,
    activo: true,
    createdAt: "2026-07-20T12:00:00Z",
    updatedAt: "2026-07-20T12:00:00Z",
  },
  {
    id: "2f3e4d5c-6b7a-899a-0b1c-2d3e4f5a6b7c",
    productoId: "c1b2c3d4-5678-90ab-cdef-1234567890ab",
    productoNombre: "Pan de Molde",
    pesoReferenciaKg: 0.8,
    toleranciaPesoPct: 5,
    dimensionBaseCm: 30,
    toleranciaDimensionCm: 0.8,
    tempMin: 170,
    tempMax: 190,
    velocidadCintaMin: 0.12,
    velocidadCintaMax: 0.28,
    activo: true,
    createdAt: "2026-07-18T09:30:00Z",
    updatedAt: "2026-07-18T09:30:00Z",
  },
  {
    id: "3f4e5d6c-7b8a-9ab0-1c2d-3e4f5a6b7c8d",
    productoId: "d1b2c3d4-5678-90ab-cdef-1234567890ab",
    productoNombre: "Galleta de Avena",
    pesoReferenciaKg: 0.04,
    toleranciaPesoPct: 12,
    dimensionBaseCm: 6,
    toleranciaDimensionCm: 0.4,
    tempMin: 150,
    tempMax: 165,
    velocidadCintaMin: 0.2,
    velocidadCintaMax: 0.4,
    activo: true,
    createdAt: "2026-07-15T15:45:00Z",
    updatedAt: "2026-07-15T15:45:00Z",
  },
  {
    id: "4f5e6d7c-8b9a-0ab1-2c3d-4e5f6a7b8c9d",
    productoId: "e1b2c3d4-5678-90ab-cdef-1234567890ab",
    productoNombre: "Croissant Mantequilla",
    pesoReferenciaKg: 0.06,
    toleranciaPesoPct: 9,
    dimensionBaseCm: 14,
    toleranciaDimensionCm: 0.6,
    tempMin: 185,
    tempMax: 205,
    velocidadCintaMin: 0.1,
    velocidadCintaMax: 0.25,
    activo: true,
    createdAt: "2026-07-10T08:00:00Z",
    updatedAt: "2026-07-10T08:00:00Z",
  },
]

const TURNOS: LoteProductivo["turno"][] = ["mañana", "tarde", "noche"]

// Deterministic pseudo-random generator so the mock history is stable.
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// Builds a stable batch-run history for a single product. The mock lotes reuse
// the given productoId so the per-product filter behaves like the backend.
export function buildLotesMockPorProducto(
  productoId: string,
  productoNombre: string,
  count = 30,
): LoteProductivo[] {
  const rand = seeded(productoId.length * 7919)
  const lotes: LoteProductivo[] = []

  for (let i = 0; i < count; i++) {
    const turno = TURNOS[i % TURNOS.length]
    const baseHour = turno === "mañana" ? 6 : turno === "tarde" ? 14 : 22
    const day = 1 + (i % 20)
    const inicio = new Date(Date.UTC(2026, 5, day, baseHour, 0, 0))
    const duracionMin = 120 + Math.floor(rand() * 90)
    const fin = new Date(inicio.getTime() + duracionMin * 60000)

    const tempH1 = 155 + Math.floor(rand() * 40)
    const tempH2 = 158 + Math.floor(rand() * 40)

    lotes.push({
      id: `mock-lote-${productoId.slice(0, 4)}-${i}`,
      productoId,
      productoNombre,
      turno,
      inicioAt: inicio.toISOString(),
      finAt: fin.toISOString(),
      tempHorno1: tempH1,
      tempCombHorno1: rand() > 0.3 ? tempH1 - 12 - Math.floor(rand() * 8) : null,
      tempHorno2: tempH2,
      tempCombHorno2: rand() > 0.3 ? tempH2 - 12 - Math.floor(rand() * 8) : null,
      velocidadCinta: 0.1 + Math.floor(rand() * 40) / 100,
    })
  }

  return lotes
}

export function getParametrosMockPorProducto(productoId: string) {
  return PARAMETROS_PRODUCTOS_MOCK.find((p) => p.productoId === productoId) ?? null
}

export function getLotesMockPorProducto(
  productoId: string,
  page: number,
  pageSize: number,
): LotesPorProducto {
  const producto =
    getParametrosMockPorProducto(productoId) ?? PARAMETROS_PRODUCTOS_MOCK[0]
  const all = buildLotesMockPorProducto(productoId, producto.productoNombre)
  const start = (page - 1) * pageSize
  return {
    items: all.slice(start, start + pageSize),
    total: all.length,
    page,
    pageSize,
  }
}
