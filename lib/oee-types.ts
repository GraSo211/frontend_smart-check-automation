// Contrato de GET /api/v1/reportes/oee.
// Tasas y promedios viajan como `null` cuando no hay datos; los arrays llegan
// siempre como `[]` y `energy` puede faltar en respuestas viejas.

export type ReporteOEEPeriodo = {
    desde: string
    hasta: string
    timezone: string
}

export type ReporteOEEFiltros = {
    sector_id: string | null
}

export type ReporteOEEEnergia = {
    kwh: number | null
    gas_m3: number | null
    kwh_por_kg_ok: number | null
    gas_m3_por_kg_ok: number | null
}

export type ReporteOEEResumen = {
    sector_id: string
    sector_nombre: string
    calculable: boolean
    motivos: string[]
    availability_pct: number | null
    performance_pct: number | null
    quality_pct: number | null
    oee_pct: number | null
    planned_time_min: number
    planned_downtime_min: number
    unplanned_downtime_min: number
    operating_time_min: number
    kg_plan: number
    kg_producidos: number
    kg_ok: number
    capacidad_teorica_kg: number
    energy?: ReporteOEEEnergia
}

export type ReporteOEE = {
    periodo: ReporteOEEPeriodo
    filtros: ReporteOEEFiltros
    global: ReporteOEEResumen
    por_sector: ReporteOEEResumen[]
}
