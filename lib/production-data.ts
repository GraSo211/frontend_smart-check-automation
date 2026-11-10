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
  /**
   * Confianza promedio del modelo de visión (0..1). `null` cuando el lote no
   * tuvo detecciones con confianza o es anterior a esta columna.
   */
  confianza_promedio?: number | null
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
  /** Contrato Go; la UI actual no lo lee. */
  iniciado_manualmente?: boolean
  ventana_evaluacion_segundos?: number
  ventana_actualizacion_segundos?: number
  tolerancia_temp_c?: number
  umbral_aceptacion_crudo?: number
  umbral_aceptacion_quemado?: number
  /** Límite de variación de T1 por ciclo; `null`/ausente usa el valor del producto. */
  delta_temp1_max_c?: number | null
  /** Límite de variación de velocidad por ciclo; `null`/ausente usa el valor del producto. */
  delta_vel_max?: number | null
  temp1_objetivo?: number | null
  vel_objetivo?: number | null
  /** Contrato Go; la UI actual no lo lee (los pesos se editan por /control/parametros). */
  pesos_objetivo?: PesosObjetivo | null
}

/** Lote option shared by the manual consigna form and its panel. */
export type LoteOption = {
  id: string
  label: string
  modo?: NonNullable<LoteSector["modo"]>
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
  /** El optimizador no encontró candidato que cumpla límites de crudos/quemados. */
  restriccionRelajada?: boolean
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
  aprobada_por?: string | null
  aprobada_at?: string | null
  created_at: string
}

/**
 * Heartbeat de telemetría del horno reportado por la Pi ENTRADA.
 * Devuelto por GET /api/v1/lotes/{id}/metricas-horno.
 */
export type MetricaHorno = {
  id: string
  lote_id: string
  temp_horno_1?: number | null
  temp_comb_1?: number | null
  humedad_horno?: number | null
  temp_ambiente?: number | null
  humedad_ambiente?: number | null
  velocidad_cinta?: number | null
  temp_objetivo?: number | null
  vel_objetivo?: number | null
  confianza_deteccion?: number | null
  received_at: string
}

/**
 * Setpoint propuesto por el MPC pendiente de aprobación en modo SUPERVISION.
 * Devuelto por GET /api/v1/lotes/{id}/consigna-propuesta (204 cuando no hay
 * propuesta pendiente). Coincide con la propuesta que el Loop del backend
 * publica por `control.propuesta` en SSE.
 */
/**
 * Límites operativos del control propuestos para el lote. Devuelto dentro de
 * `GET /api/v1/lotes/{id}/consigna-propuesta` como `limites`.
 */
export type ControlLimites = {
  temp_min: number
  temp_max: number
  vel_min: number
  vel_max: number
  delta_temp1_max_c: number
  delta_vel_max: number
  tolerancia_temp_c: number
}

export type SetpointPropuesto = {
  temp1: number
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
    restriccionRelajada?: boolean
  } | null
  ventana_inicio?: string
  ventana_fin?: string
  /** Indica si la propuesta ya fue aprobada por un supervisor. */
  autorizada: boolean
  fase?: string | null
  decision_id?: string | null
  /**
   * Límites operativos vigentes usados por el MPC para generar la propuesta.
   * Permite ajustar los parámetros del control en tiempo real.
   */
  limites?: ControlLimites | null
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

/**
 * Confianza agregada por clase del modelo de visión, sobre las últimas N
 * detecciones de un lote. Devuelto por GET /api/v1/lotes/{id}/confianza-clases.
 * `confianza_media` es el promedio de confianza (0..1); `confianza_stddev`
 * mide dispersión (`null` cuando `muestras < 2`). Permite tener
 * varianza alta aunque la media sea razonable.
 */
export type ConfianzaClase = {
  clase: string
  confianza_media: number
  confianza_stddev: number | null
  muestras: number
}

/** Estado del ciclo de vida de una alerta. */
export type AlertaEstado = "ACTIVA" | "ACK" | "RESUELTA"

/** Severidad declarada por el backend. */
export type AlertaSeveridad = "INFO" | "WARNING" | "CRITICAL"

/**
 * Alerta operativa: umbral de calidad, desvío de temperatura, dispositivo offline,
 * etc. Vinculada opcionalmente a un sector y a un lote. Una alerta ACK fue
 * reconocida por un usuario pero todavía no se cerró; una alerta RESUELTA
 * desapareció sola o un usuario la marcó como resuelta.
 */
export type Alerta = {
  id: string
  sector_id?: string | null
  lote_id?: string | null
  dispositivo_id?: string | null
  /** Tipo libre (`umbral_quemado`, `nodo_offline`, `temp_fuera_rango`, etc.). */
  tipo: string
  severidad: AlertaSeveridad
  estado: AlertaEstado
  mensaje: string
  created_at: string
  /** Acuse de recibo: quién y cuándo la reconoció. */
  acked_por?: { email: string; nombre: string } | null
  acked_at?: string | null
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
  /** Costo actual por pieza; null/ausente significa sin configurar. */
  costoFabricacionUnitarioArs?: number | null
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
  /** Capacidad nominal para calcular Performance/OEE; `null` si no se configuró. */
  capacidadNominalKgH: number | null
  /** Valor objetivo opcional dentro de [tempMin, tempMax]; `null`/ausente si no se usa. */
  tempSetpoint?: number | null
  /** Valor objetivo opcional dentro de [velocidadCintaMin, velocidadCintaMax]. */
  velocidadCintaSetpoint?: number | null
  createdAt?: string
  updatedAt?: string
}

/** Body for `POST /api/v1/productos` and `PUT /api/v1/productos/{id}`. */
export type ProductoRequest = {
  costoFabricacionUnitarioArs?: number | null
  nombre: string
  pesoReferenciaKg: number
  toleranciaPesoPct: number
  dimensionBaseCm: number
  toleranciaDimensionCm: number
  tempMin: number
  tempMax: number
  velocidadCintaMin: number
  velocidadCintaMax: number
  /** Opcional: `null`/ausente desactiva el cálculo de Performance/OEE. */
  capacidadNominalKgH?: number | null
  /** Si se omite o es `null`, el backend no lo persiste. */
  tempSetpoint?: number | null
  /** Si se omite o es `null`, el backend no lo persiste. */
  velocidadCintaSetpoint?: number | null
}

/**
 * Consigna manual o automática. El backend devuelve la entidad en camelCase en
 * POST /api/v1/horno/consigna y en el historial.
 * - `estado` es la fuente de verdad: `PENDIENTE` = encolada esperando ack de la
 *   Pi; `APLICADA` = confirmada por ack de la Pi; `RECHAZADA` = no se pudo
 *   encolar. `exitosa` queda por compatibilidad con backends previos.
 * - `decisionId` es el UUID de la decisión encolada (null cuando no aplica).
 */
export type Consigna = {
  id: string
  hornoId: string
  loteId?: string | null
  productoId?: string | null
  temperaturaObjetivo: number
  velocidadCintaObjetivo: number
  origen: "MANUAL" | "AUTOMATICO"
  usuario?: string | null
  /** Legacy/compatibility; prefer `estado`. */
  exitosa: boolean
  /** `PENDIENTE` | `APLICADA` | `RECHAZADA` o un valor string de transición. */
  estado?: "PENDIENTE" | "APLICADA" | "RECHAZADA" | string | null
  decisionId?: string | null
  motivoError?: string | null
  temperaturaPrevia?: number | null
  velocidadCintaPrevia?: number | null
  creadaEn: string
}

/**
 * Estado actual del horno devuelto por GET /api/v1/horno en `data.horno`.
 * Es una proyección de la última telemetría real publicada por la Pi
 * (`metricas_horno`) para el sector/lote seleccionado.
 */
export type HornoEstado = {
  id: string
  nombre: string
  sector_id?: string
  lote_id?: string | null
  producto_id?: string | null
  temperatura: number | null
  velocidad_cinta: number | null
  temp_comb_1?: number | null
  humedad_horno?: number | null
  temp_ambiente?: number | null
  humedad_ambiente?: number | null
  temp_objetivo?: number | null
  vel_objetivo?: number | null
  confianza_deteccion?: number | null
  estado: string
  fuente?: string
  ultimo_check: string | null
  antiguedad_segundos?: number | null
}

/** Valores crudos del formulario de consigna manual. */
export type ConsignaInput = {
  temperaturaObjetivo: number | string
  velocidadCintaObjetivo: number | string
}

/** Errores de validación por campo del formulario de consigna manual. */
export type ConsignaErrores = Partial<Record<keyof ConsignaInput, string>>

/** Errores de validación por campo del formulario de producto. */
export type ProductoErrores = Partial<Record<keyof ProductoRequest, string>>

/**
 * Replica las reglas del `ProductoRequest.Validate()` del backend para que el
 * formulario muestre los mismos errores antes de enviar. Devuelve un mapa por
 * campo; vacío cuando el request es válido.
 */
export function validateProducto(values: ProductoRequest): ProductoErrores {
  const errors: ProductoErrores = {}

  const costo = values.costoFabricacionUnitarioArs
  if (costo != null && (!Number.isFinite(costo) || costo < 0 || costo > 9999999999.99 || costo !== Math.round(costo * 100) / 100)) {
    errors.costoFabricacionUnitarioArs = "Ingresá un importe entre 0 y 9.999.999.999,99 ARS, con hasta 2 decimales."
  }

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

  // Capacidad nominal opcional: sólo se valida si viene con valor.
  if (values.capacidadNominalKgH != null) {
    if (!Number.isFinite(values.capacidadNominalKgH)) {
      errors.capacidadNominalKgH = "Ingresá un número."
    } else if (!(values.capacidadNominalKgH > 0)) {
      errors.capacidadNominalKgH = "Debe ser mayor a 0."
    }
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

/**
 * Replica las validaciones de rango del backend para el formulario de consigna
 * manual. Devuelve un mapa por campo; vacío cuando el valor está dentro de los
 * límites del producto.
 */
export function validateConsignaInput(
  producto: Producto,
  input: ConsignaInput,
): ConsignaErrores {
  const errors: ConsignaErrores = {}

  const temperatura =
    typeof input.temperaturaObjetivo === "string"
      ? parseFloat(input.temperaturaObjetivo)
      : input.temperaturaObjetivo
  if (!Number.isFinite(temperatura)) {
    errors.temperaturaObjetivo = "Ingresá un número."
  } else if (temperatura < producto.tempMin || temperatura > producto.tempMax) {
    errors.temperaturaObjetivo = `Debe estar entre ${producto.tempMin} y ${producto.tempMax} °C.`
  }

  const velocidad =
    typeof input.velocidadCintaObjetivo === "string"
      ? parseFloat(input.velocidadCintaObjetivo)
      : input.velocidadCintaObjetivo
  if (!Number.isFinite(velocidad)) {
    errors.velocidadCintaObjetivo = "Ingresá un número."
  } else if (
    velocidad < producto.velocidadCintaMin ||
    velocidad > producto.velocidadCintaMax
  ) {
    errors.velocidadCintaObjetivo = `Debe estar entre ${producto.velocidadCintaMin} y ${producto.velocidadCintaMax} m/s.`
  }

  return errors
}
