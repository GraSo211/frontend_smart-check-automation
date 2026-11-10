import type { ImpactoEconomico } from "@/lib/economia-merma"

// Contrato de GET /api/v1/reportes/{resumen,lotes}
// (backend_smart-check-automation_go/docs/api-endpoints.md §31 y §32).
// Las tasas, promedios y duraciones viajan como `null` cuando no hay datos;
// los arrays siempre llegan como `[]`.

export type ReportePeriodo = {
    desde: string
    hasta: string
    timezone: string
}

export type ReporteFiltrosAplicados = {
    sector_id: string | null
    producto_id: string | null
    turno: string | null
}

export type ReporteEconomico = {
    periodo: ReportePeriodo
    filtros: ReporteFiltrosAplicados
    impacto_economico: ImpactoEconomico
}

export type ReporteGrupo = {
    clave: string
    nombre: string
    lotes: number
    unidades: number
    kg_estimados: number
    fpy_pct: number | null
}

export type ReporteProduccion = {
    lotes_total: number
    lotes_cerrados: number
    lotes_abiertos: number
    unidades: number
    unidades_ok: number
    unidades_crudas: number
    unidades_quemadas: number
    kg_total_estimados: number
    kg_ok_estimados: number
    kg_merma_estimados: number
    duracion_media_min: number | null
    duracion_p95_min: number | null
    unidades_por_hora: number | null
    kg_por_hora: number | null
    por_turno: ReporteGrupo[]
    por_sector: ReporteGrupo[]
    por_producto: ReporteGrupo[]
}

export type ReporteSerieCalidad = {
    fecha: string
    lotes: number
    unidades: number
    kg_estimados: number
    fpy_pct: number | null
    crudo_pct: number | null
    quemado_pct: number | null
}

export type ReporteCalidad = {
    fpy_pct: number | null
    crudo_pct: number | null
    quemado_pct: number | null
    confianza_promedio: number | null
    lotes_conformes_pct: number | null
    serie_diaria: ReporteSerieCalidad[]
}

export type ReporteSerieProceso = {
    fecha: string
    temp_real_prom: number | null
    temp_objetivo_prom: number | null
    temp_en_tolerancia_pct: number | null
}

export type ReporteProceso = {
    temp_mae_c: number | null
    temp_en_tolerancia_pct: number | null
    vel_mae: number | null
    vel_en_tolerancia_pct: number | null
    serie_diaria: ReporteSerieProceso[]
}

export type ReporteClaveTotal = {
    clave: string
    total: number
}

export type ReporteSerieAlertas = {
    fecha: string
    total: number
    criticas: number
}

export type ReporteAlertas = {
    total: number
    por_severidad: Record<string, number>
    por_tipo: ReporteClaveTotal[]
    ack_pct: number | null
    mtta_min: number | null
    serie_diaria: ReporteSerieAlertas[]
}

export type ReporteAutomatizacion = {
    decisiones_total: number
    mpc_pct: number | null
    operario_pct: number | null
    sin_aplicar_pct: number | null
    z_mae: number | null
    top_skip: ReporteClaveTotal[]
    // El backend precarga AUTOMATICO/SUPERVISION/MANUAL; queda null si no hubo
    // duración de lotes en ese modo.
    modo_pct: Record<string, number | null>
}

export type ReporteResumen = {
    /** Opcional para admitir un backend anterior durante el despliegue. */
    impacto_economico?: ImpactoEconomico
    periodo: ReportePeriodo
    filtros: ReporteFiltrosAplicados
    produccion: ReporteProduccion
    calidad: ReporteCalidad
    proceso: ReporteProceso
    alertas: ReporteAlertas
    automatizacion: ReporteAutomatizacion
}

export type ReporteConteos = {
    ok: number | null
    crudo: number | null
    quemado: number | null
    total: number
}

export type ReporteKg = {
    ok: number | null
    crudo: number | null
    quemado: number | null
    total: number | null
    merma: number | null
}

export type ReporteLote = {
    costo_fabricacion_unitario_ars?: number | null
    perdida_merma_ars?: number | null
    id: string
    sector_id: string
    sector_nombre: string
    producto_id: string
    producto_nombre: string
    turno: string | null
    estado: string
    abierto_en: string
    cerrado_en: string | null
    motivo_cierre: string | null
    modo: string | null
    conteos: ReporteConteos
    kg: ReporteKg
    confianza_promedio: number | null
    duracion_min: number | null
    fpy_pct: number | null
    crudo_pct: number | null
    quemado_pct: number | null
}

export type ReporteLotesPage = {
    lotes: ReporteLote[]
    total: number
    page: number
    pageSize: number
    siguienteCursor: string | null
}

// ─── Trazabilidad de un lote (docs/api-endpoints.md §33) ────────────────────
// El lote repite el shape del detalle y agrega los parámetros de control.

export type ReporteTrazabilidadLote = ReporteLote & {
    temp1_objetivo: number | null
    vel_objetivo: number | null
    tolerancia_temp_c: number | null
    umbral_aceptacion_crudo: number | null
    umbral_aceptacion_quemado: number | null
    delta_temp1_max_c: number | null
    delta_vel_max: number | null
}

export type ReporteTrazabilidadPunto = {
    ts: string
    temp_real: number | null
    temp_objetivo: number | null
    vel_real: number | null
    vel_objetivo: number | null
    muestras: number
}

export type ReporteTrazabilidadProceso = {
    temp_mae_c: number | null
    temp_en_tolerancia_pct: number | null
    vel_mae: number | null
    vel_en_tolerancia_pct: number | null
    serie: ReporteTrazabilidadPunto[]
}

export type ReporteTrazabilidadConfianza = {
    clase: string
    confianza_media: number | null
    confianza_stddev: number | null
    muestras: number
}

export type ReporteTrazabilidadDecision = {
    id: string
    creada_en: string
    ventana_inicio: string
    ventana_fin: string
    muestras: number
    temp_actual: number | null
    vel_actual: number | null
    pct_ok_obs: number | null
    pct_crudos_obs: number | null
    pct_quemados_obs: number | null
    conf_promedio: number | null
    temp_propuesto: number | null
    vel_propuesto: number | null
    temp_aplicado: number | null
    vel_aplicado: number | null
    z_observado: number | null
    z_predicho: number | null
    razon_skipped: string | null
    aplicado_por: string | null
    aprobada_por: string | null
    aprobada_at: string | null
}

export type ReporteTrazabilidadConsigna = {
    id: string
    creada_en: string
    temperatura_objetivo: number | null
    velocidad_cinta_objetivo: number | null
    origen: string
    usuario: string | null
    exitosa: boolean
    estado?: string | null
    decision_id?: string | null
    motivo_error: string | null
    temperatura_previa: number | null
    velocidad_cinta_previa: number | null
}

export type ReporteTrazabilidadAlerta = {
    id: string
    creada_en: string
    tipo: string
    severidad: string
    estado: string
    mensaje: string
    acked_at: string | null
}

export type ReporteTrazabilidad = {
    lote: ReporteTrazabilidadLote
    proceso: ReporteTrazabilidadProceso
    confianza_clases: ReporteTrazabilidadConfianza[]
    decisiones: ReporteTrazabilidadDecision[]
    consignas: ReporteTrazabilidadConsigna[]
    alertas: ReporteTrazabilidadAlerta[]
    generado_en: string
}

// ─── Alertas del período (GET /api/v1/reportes/alertas) ─────────────────────

export type ReporteAlerta = {
    id: string
    creada_en: string
    sector_id: string
    sector_nombre: string
    lote_id: string
    producto_id: string
    producto_nombre: string
    turno: string | null
    tipo: string
    severidad: string
    estado: string
    mensaje: string
    acked_at: string | null
    acked_por: string | null
    mtta_min: number | null
}

export type ReporteAlertasData = {
    total: number
    truncada: boolean
    alertas: ReporteAlerta[]
}
