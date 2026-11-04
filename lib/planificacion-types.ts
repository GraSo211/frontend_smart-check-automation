// Contrato de GET /api/v1/planificacion/{plan|paradas|energia} y DELETE .../{id}.
// El backend responde snake_case; estos tipos se usan tal cual.

export type PlanificacionListaFiltros = {
    desde?: string
    hasta?: string
    sectorId?: string
    limite?: number
}

export type PlanificacionPlanItem = {
    id: string
    sector_id: string
    sector_nombre: string
    producto_id: string
    producto_nombre: string
    fecha: string
    turno: string
    inicio_at: string
    fin_at: string
    kg_plan: number
}

export type PlanificacionParadaItem = {
    id: string
    sector_id: string
    sector_nombre: string
    lote_id: string | null
    inicio_at: string
    fin_at: string
    causa_codigo: string
    tipo: string
    notas: string | null
}

export type PlanificacionEnergiaItem = {
    id: string
    sector_id: string
    sector_nombre: string
    lote_id: string | null
    periodo_inicio: string
    periodo_fin: string
    kwh: number
    gas_m3: number | null
}

/** Item por tipo de planificación (los tres no comparten forma). */
export type PlanificacionItemPorTipo = {
    plan: PlanificacionPlanItem
    paradas: PlanificacionParadaItem
    energia: PlanificacionEnergiaItem
}

export type PlanificacionItem = PlanificacionItemPorTipo[keyof PlanificacionItemPorTipo]

export type PlanificacionLista<T extends PlanificacionItem = PlanificacionItem> = {
    total: number
    truncada: boolean
    items: T[]
}
