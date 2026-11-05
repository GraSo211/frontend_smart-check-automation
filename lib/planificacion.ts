// Importación CSV de planificación. Estos helpers viven fuera de actions/api.ts
// porque ese módulo es "use server" y Turbopack exige que todo export sea async.

import type { PlanificacionListaFiltros } from "@/lib/planificacion-types"

export type TipoImportacion = "plan" | "paradas"

type PlantillaCsv = { headers: readonly string[]; ejemplo: readonly string[] }

const PLANTILLAS: Record<TipoImportacion, PlantillaCsv> = {
    plan: {
        headers: ["sector_id", "fecha", "turno", "producto_id", "inicio", "fin", "kg_plan"],
        ejemplo: ["s1", "2026-11-01", "mañana", "00000000-0000-0000-0000-000000000001", "2026-11-01T06:00:00-03:00", "2026-11-01T14:00:00-03:00", "1000"],
    },
    paradas: {
        headers: ["sector_id", "lote_id", "causa_codigo", "tipo", "inicio", "fin", "notas"],
        ejemplo: ["s1", "", "MANTENIMIENTO", "NO_PLANIFICADA", "2026-11-01T10:00:00-03:00", "2026-11-01T11:00:00-03:00", "cambio de cinta"],
    },
}

// hasOwnProperty y no `in`: "toString" o "__proto__" no son tipos válidos.
export function isTipoImportacion(value: unknown): value is TipoImportacion {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(PLANTILLAS, value)
}

export function buildImportUrl(tipo: TipoImportacion): string {
    return `/api/planificacion/${tipo}/import`
}

// Query en snake_case: el proxy la reenvía tal cual al backend.
export function buildPlanificacionListaUrl(
    tipo: TipoImportacion,
    filtros: PlanificacionListaFiltros = {},
): string {
    const params = new URLSearchParams()
    if (filtros.desde) params.set("desde", filtros.desde)
    if (filtros.hasta) params.set("hasta", filtros.hasta)
    if (filtros.sectorId) params.set("sector_id", filtros.sectorId)
    if (filtros.limite !== undefined) params.set("limite", String(filtros.limite))
    const query = params.toString()
    return `/api/planificacion/${tipo}${query ? `?${query}` : ""}`
}

export function buildPlanificacionItemUrl(tipo: TipoImportacion, id: string): string {
    return `/api/planificacion/${tipo}/${encodeURIComponent(id)}`
}

export function buildCsvTemplate(tipo: TipoImportacion): string {
    const { headers, ejemplo } = PLANTILLAS[tipo]
    return `${headers.join(",")}\n${ejemplo.join(",")}\n`
}
