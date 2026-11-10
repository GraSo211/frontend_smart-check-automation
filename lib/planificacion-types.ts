// Contrato de GET /api/v1/planificacion/{plan|paradas} y DELETE .../{id}.
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

/** Item por tipo de planificación (los dos no comparten forma). */
export type PlanificacionItemPorTipo = {
    plan: PlanificacionPlanItem
    paradas: PlanificacionParadaItem
}

export type PlanificacionItem = PlanificacionItemPorTipo[keyof PlanificacionItemPorTipo]

export type PlanificacionLista<T extends PlanificacionItem = PlanificacionItem> = {
    total: number
    truncada: boolean
    items: T[]
}
