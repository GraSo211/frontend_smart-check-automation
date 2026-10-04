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
  // SCA-400: control automático / supervisión.
  modo?: "MANUAL" | "SUPERVISION" | "AUTOMATICO"
  horno2_habilitado?: boolean
  iniciado_manualmente?: boolean
  ventana_evaluacion_segundos?: number
  ventana_actualizacion_segundos?: number
  tolerancia_temp_c?: number
  umbral_aceptacion_crudo?: number
  umbral_aceptacion_quemado?: number
  temp1_objetivo?: number | null
  temp2_objetivo?: number | null
  vel_objetivo?: number | null
  pesos_objetivo?: PesosObjetivo | null
}

export type PesosObjetivo = {
  wc: number
  wq: number
  wo: number
  dt: number
  dc: number
}

/** Subset de la salida del XGBoost que devuelve el backend por decisión.
 * Permite distinguir si la propuesta vino del modelo entrenado o del
 * placeholder determinístico (`esPlaceholder: true` cuando todavía no hay
 * muestras suficientes para entrenar por producto). */
export type PrediccionResumen = {
  pctCrudos: number
  pctOk: number
  pctQuemados: number
  modelVersion: string
  esPlaceholder: boolean
}

/** Decisión del MPC (audit) tal como devuelve GET /api/v1/lotes/{id}/decisiones. */
export type DecisionControl = {
  id: string
  lote_id: string
  ventana_inicio: string
  ventana_fin: string
  muestras: number
  temp_actual: number
  vel_actual?: number | null
  pct_crudos_obs: number
  pct_ok_obs: number
  pct_quemados_obs: number
  conf_promedio: number
  temp_propuesto: number
  vel_propuesto: number
  temp_aplicado?: number | null
  vel_aplicado?: number | null
  prediccion?: PrediccionResumen | null
  z_observado?: number | null
  z_predicho?: number | null
  razon_skipped?: string | null
  aplicado_por: "MPC" | "OPERARIO" | "NADIE"
  created_at: string
}

/**
 * Setpoint propuesto por el MPC pendiente de aprobación en modo SUPERVISION.
 * Devuelto por GET /api/v1/lotes/{id}/consigna-propuesta (204 cuando no hay
 * propuesta pendiente). Coincide con la propuesta que el Loop del backend
 * publica por `control.propuesta` en SSE.
 */
export type SetpointPropuesto = {
  temp1: number
  /** T2 del horno 2. Sólo presente cuando el producto tiene horno 2 habilitado. */
  temp2?: number | null
  velocidad: number
  /** Z predicha por el optimizador en el momento de proponer. */
  z: number
  /** Salida cruda del XGBoost que alimentó la decisión. */
  prediccion?: {
    pctCrudos?: number
    pctOk?: number
    pctQuemados?: number
    modelVersion?: string
    esPlaceholder?: boolean
  } | null
  ventana_inicio?: string
  ventana_fin?: string
}

/**
 * Estado actual del loop de control de un lote. Devuelto por GET
 * /api/v1/lotes/{id}/control/estado. `loop_activo` distingue entre "modo
 * operativo ≠ MANUAL" y "loop del MPC realmente corriendo" — sin esta
 * distinción la UI no puede detectar un loop que se cayó o nunca arrancó.
 */
export type ControlEstado = {
  loop_activo: boolean
  modo: NonNullable<LoteSector["modo"]>
  /** Cuándo arrancó el loop; ausente cuando `loop_activo === false`. */
  started_at?: string | null
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
  /** Valor objetivo opcional dentro de [tempMin, tempMax]; `null`/ausente si no se usa. */
  tempSetpoint?: number | null
  /** Valor objetivo opcional dentro de [velocidadCintaMin, velocidadCintaMax]. */
  velocidadCintaSetpoint?: number | null
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
  /** Si se omite o es `null`, el backend no lo persiste. */
  tempSetpoint?: number | null
  /** Si se omite o es `null`, el backend no lo persiste. */
  velocidadCintaSetpoint?: number | null
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

  // Setpoints opcionales: sólo se validan si vienen con valor. Un setpoint sin
  // rango válido no se puede chequear, así que se omite (el error de min/max ya
  // se muestra por su lado).
  if (values.tempSetpoint != null) {
    if (!Number.isFinite(values.tempSetpoint)) {
      errors.tempSetpoint = "Ingresá un número."
    } else if (
      Number.isFinite(values.tempMin) &&
      Number.isFinite(values.tempMax) &&
      !(values.tempSetpoint >= values.tempMin && values.tempSetpoint <= values.tempMax)
    ) {
      errors.tempSetpoint = "Debe estar entre tempMin y tempMax."
    }
  }
  if (values.velocidadCintaSetpoint != null) {
    if (!Number.isFinite(values.velocidadCintaSetpoint)) {
      errors.velocidadCintaSetpoint = "Ingresá un número."
    } else if (
      Number.isFinite(values.velocidadCintaMin) &&
      Number.isFinite(values.velocidadCintaMax) &&
      !(
        values.velocidadCintaSetpoint >= values.velocidadCintaMin &&
        values.velocidadCintaSetpoint <= values.velocidadCintaMax
      )
    ) {
      errors.velocidadCintaSetpoint = "Debe estar entre la velocidad mínima y máxima."
    }
  }

  return errors
}
