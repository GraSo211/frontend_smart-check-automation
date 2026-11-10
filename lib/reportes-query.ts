// Query builder puro de los reportes. Vive fuera de actions/api.ts porque ese
// módulo es "use server" y Turbopack exige que todo export sea async.

export type ReporteFiltros = {
    desde?: string | null
    hasta?: string | null
    sectorId?: string | null
    productoId?: string | null
    turno?: string | null
    /** Sólo lo usa /reportes/alertas. */
    estado?: string | null
}

/** Query string `desde=…&hasta=…&sector_id=…&producto_id=…&turno=…&estado=…`. */
export function buildReporteQuery(filtros: ReporteFiltros = {}): string {
    const params = new URLSearchParams()
    if (filtros.desde) params.set("desde", filtros.desde)
    if (filtros.hasta) params.set("hasta", filtros.hasta)
    if (filtros.sectorId) params.set("sector_id", filtros.sectorId)
    if (filtros.productoId) params.set("producto_id", filtros.productoId)
    if (filtros.turno) params.set("turno", filtros.turno)
    if (filtros.estado) params.set("estado", filtros.estado)
    return params.toString()
}
