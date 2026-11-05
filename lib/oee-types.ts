// Contrato de GET /api/v1/reportes/oee.
// Tasas y promedios viajan como `null` cuando no hay datos; los arrays llegan
// siempre como `[]`.

export type ReporteOEEPeriodo = {
    desde: string
    hasta: string
    timezone: string
}

export type ReporteOEEFiltros = {
    sector_id: string | null
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
}

export type ReporteOEE = {
    periodo: ReporteOEEPeriodo
    filtros: ReporteOEEFiltros
    global: ReporteOEEResumen
    por_sector: ReporteOEEResumen[]
}
