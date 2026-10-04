import type { LoteSector } from "@/lib/production-data"
import { qualityRate } from "@/lib/format"

export type ReportFormat = "csv" | "json"

export interface ReportFilters {
    /** Formato de salida del archivo (`csv` o `json`). */
    format: ReportFormat
    /** Filtra por un lote específico; tiene precedencia sobre `fechas`. */
    loteId?: string | null
    /** ISO date; conserva sólo lotes con `abierto_en >= desde`. */
    desde?: string | null
    /** ISO date; conserva sólo lotes con `abierto_en <= hasta`. */
    hasta?: string | null
}

export interface BuiltReport {
    /** Cuerpo serializado del archivo (CSV con BOM UTF-8 o JSON pretty). */
    body: string
    /** Content-Type del response. */
    contentType: string
    /** Nombre sugerido del archivo (incluye fecha de generación). */
    filename: string
    /** Cantidad de filas efectivamente exportadas. */
    rows: number
}

/**
 * Aplica los filtros de `ReportFilters` sobre una lista de lotes en memoria.
 * Cuando se pasa `loteId`, tiene precedencia absoluta: `desde`/`hasta` se
 * ignoran. Las fechas se comparan con `Date.parse` sobre `abierto_en`.
 */
export function filterLotesForReport(
    runs: LoteSector[],
    filters: { loteId?: string | null; desde?: string | null; hasta?: string | null },
): LoteSector[] {
    if (filters.loteId && filters.loteId !== "") {
        return runs.filter((r) => r.id === filters.loteId)
    }
    const desdeMs = filters.desde ? Date.parse(filters.desde) : null
    const hastaMs = filters.hasta ? Date.parse(filters.hasta) : null
    return runs.filter((r) => {
        const openMs = Date.parse(r.abierto_en)
        if (!Number.isFinite(openMs)) return false
        if (desdeMs !== null && Number.isFinite(desdeMs) && openMs < desdeMs) return false
        if (hastaMs !== null && Number.isFinite(hastaMs) && openMs > hastaMs) return false
        return true
    })
}

/**
 * Genera el archivo final (CSV o JSON) a partir de los lotes ya filtrados.
 * Es puro: no hace fetch ni side-effects; los tests lo ejercitan directo.
 */
export function buildLotesReport(
    runs: LoteSector[],
    filters: ReportFilters,
): BuiltReport {
    const filtered = filterLotesForReport(runs, filters)
    const generatedAt = new Date().toISOString()
    const stem = buildFilenameStem(filters, generatedAt)

    if (filters.format === "json") {
        const body = JSON.stringify(
            {
                generated_at: generatedAt,
                total: filtered.length,
                lotes: filtered.map(serializeLote),
            },
            null,
            2,
        )
        return {
            body,
            contentType: "application/json; charset=utf-8",
            filename: `${stem}.json`,
            rows: filtered.length,
        }
    }

    // CSV. Emitimos BOM UTF-8 para que Excel abra correctamente con acentos.
    const header = [
        "id",
        "sector_id",
        "producto_id",
        "producto_nombre",
        "estado",
        "abierto_en",
        "cerrado_en",
        "motivo_cierre",
        "total",
        "ok",
        "quemado",
        "crudo",
        "calidad_pct",
        "modo",
        "ventana_evaluacion_segundos",
        "ventana_actualizacion_segundos",
        "tolerancia_temp_c",
        "temp1_objetivo",
        "temp2_objetivo",
        "vel_objetivo",
    ]
    const lines = [header.join(",")]
    for (const lote of filtered) {
        const row = buildRow(lote)
        lines.push(row.map(csvEscape).join(","))
    }
    const body = "\uFEFF" + lines.join("\r\n") + "\r\n"
    return {
        body,
        contentType: "text/csv; charset=utf-8",
        filename: `${stem}.csv`,
        rows: filtered.length,
    }
}

function serializeLote(l: LoteSector): Record<string, unknown> {
    return {
        id: l.id,
        sector_id: l.sector_id,
        producto_id: l.producto_id,
        producto_nombre: l.producto_nombre,
        estado: l.estado,
        abierto_en: l.abierto_en,
        cerrado_en: l.cerrado_en,
        motivo_cierre: l.motivo_cierre,
        conteos: l.conteos,
        calidad_pct: l.conteos.total > 0 && l.conteos.ok !== null
            ? qualityRate(l.conteos.ok, l.conteos.total).toFixed(1)
            : null,
        modo: l.modo ?? null,
        ventana_evaluacion_segundos: l.ventana_evaluacion_segundos ?? null,
        ventana_actualizacion_segundos: l.ventana_actualizacion_segundos ?? null,
        tolerancia_temp_c: l.tolerancia_temp_c ?? null,
        temp1_objetivo: l.temp1_objetivo ?? null,
        temp2_objetivo: l.temp2_objetivo ?? null,
        vel_objetivo: l.vel_objetivo ?? null,
    }
}

function buildRow(l: LoteSector): Array<string | number | null> {
    return [
        l.id,
        l.sector_id,
        l.producto_id,
        l.producto_nombre,
        l.estado,
        l.abierto_en,
        l.cerrado_en ?? "",
        l.motivo_cierre ?? "",
        l.conteos.total,
        l.conteos.ok ?? "",
        l.conteos.quemado ?? "",
        l.conteos.crudo ?? "",
        l.conteos.total > 0 && l.conteos.ok !== null
            ? qualityRate(l.conteos.ok, l.conteos.total).toFixed(1)
            : "",
        l.modo ?? "",
        l.ventana_evaluacion_segundos ?? "",
        l.ventana_actualizacion_segundos ?? "",
        l.tolerancia_temp_c ?? "",
        l.temp1_objetivo ?? "",
        l.temp2_objetivo ?? "",
        l.vel_objetivo ?? "",
    ]
}

// Escape RFC 4180: envuelve en comillas dobles si el campo contiene
// separadores, comillas o saltos de línea. Comillas internas se duplican.
function csvEscape(value: string | number | null): string {
    if (value === null || value === undefined) return ""
    const str = typeof value === "number" ? String(value) : value
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function buildFilenameStem(filters: ReportFilters, generatedAt: string): string {
    const date = generatedAt.slice(0, 10)
    if (filters.loteId) return `lotes-${filters.loteId}-${date}`
    if (filters.desde || filters.hasta) {
        const d = filters.desde?.slice(0, 10) ?? "inicio"
        const h = filters.hasta?.slice(0, 10) ?? "hoy"
        return `lotes-${d}_a_${h}`
    }
    return `lotes-${date}`
}