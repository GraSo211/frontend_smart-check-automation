import type { ReporteLote } from "@/lib/reportes-types"
import { APP_TIME_ZONE } from "@/lib/format"

export type ReportFormat = "csv" | "json"

export type ReportDelimiter = "," | ";"

export interface ReportFilters {
    /** Formato de salida del archivo (`csv` o `json`). */
    format: ReportFormat
    /** Separador CSV. `;` activa coma decimal y fechas dd/mm/aaaa hh:mm. */
    delimiter?: ReportDelimiter
    /** Rango del backend (YYYY-MM-DD), inclusivo. */
    desde?: string | null
    hasta?: string | null
    sectorId?: string | null
    productoId?: string | null
    turno?: string | null
}

export interface BuiltReport {
    /** Cuerpo serializado del archivo (CSV con BOM UTF-8 o JSON pretty). */
    body: string
    /** Content-Type del response. */
    contentType: string
    /** Nombre sugerido del archivo. */
    filename: string
    /** Cantidad de filas efectivamente exportadas. */
    rows: number
}

const CSV_HEADER = [
    "id",
    "sector_id",
    "sector_nombre",
    "producto_id",
    "producto_nombre",
    "turno",
    "estado",
    "abierto_en",
    "cerrado_en",
    "motivo_cierre",
    "modo",
    "total",
    "ok",
    "crudo",
    "quemado",
    "kg_ok",
    "kg_crudo",
    "kg_quemado",
    "kg_total",
    "kg_merma",
    "confianza_promedio",
    "duracion_min",
    "fpy_pct",
    "crudo_pct",
    "quemado_pct",
] as const

/**
 * Genera el archivo final (CSV o JSON) a partir de los lotes que ya devolvió
 * GET /api/v1/reportes/lotes. Es puro: no hace fetch ni side-effects.
 */
export function buildLotesReport(
    lotes: ReporteLote[],
    filters: ReportFilters,
): BuiltReport {
    const generatedAt = new Date().toISOString()
    const stem = buildFilenameStem(filters)

    if (filters.format === "json") {
        const body = JSON.stringify(
            {
                generated_at: generatedAt,
                total: lotes.length,
                filtros: {
                    desde: filters.desde ?? null,
                    hasta: filters.hasta ?? null,
                    sector_id: filters.sectorId ?? null,
                    producto_id: filters.productoId ?? null,
                    turno: filters.turno ?? null,
                },
                lotes,
            },
            null,
            2,
        )
        return {
            body,
            contentType: "application/json; charset=utf-8",
            filename: `${stem}.json`,
            rows: lotes.length,
        }
    }

    const delimiter = filters.delimiter === ";" ? ";" : ","
    const esAr = delimiter === ";"
    const lines = [CSV_HEADER.join(delimiter)]
    for (const lote of lotes) {
        lines.push(buildRow(lote, delimiter, esAr).join(delimiter))
    }
    const body = "\uFEFF" + lines.join("\r\n") + "\r\n"
    return {
        body,
        contentType: "text/csv; charset=utf-8",
        filename: `${stem}.csv`,
        rows: lotes.length,
    }
}

function buildRow(
    l: ReporteLote,
    delimiter: ReportDelimiter,
    esAr: boolean,
): string[] {
    const num = (value: number | null) => formatNumber(value, esAr)
    const date = (value: string | null) => formatDate(value, esAr)
    return [
        text(l.id, delimiter),
        text(l.sector_id, delimiter),
        text(l.sector_nombre, delimiter),
        text(l.producto_id, delimiter),
        text(l.producto_nombre, delimiter),
        text(l.turno, delimiter),
        text(l.estado, delimiter),
        text(date(l.abierto_en), delimiter),
        text(date(l.cerrado_en), delimiter),
        text(l.motivo_cierre, delimiter),
        text(l.modo, delimiter),
        num(l.conteos.total),
        num(l.conteos.ok),
        num(l.conteos.crudo),
        num(l.conteos.quemado),
        num(l.kg.ok),
        num(l.kg.crudo),
        num(l.kg.quemado),
        num(l.kg.total),
        num(l.kg.merma),
        num(l.confianza_promedio),
        num(l.duracion_min),
        num(l.fpy_pct),
        num(l.crudo_pct),
        num(l.quemado_pct),
    ]
}

// Neutraliza fórmulas de hoja de cálculo en strings. Los números no se tocan.
function neutralize(value: string): string {
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function text(value: string | null, delimiter: ReportDelimiter): string {
    if (value === null || value === undefined) return ""
    return csvEscape(neutralize(value), delimiter)
}

function formatNumber(value: number | null, esAr: boolean): string {
    if (value === null || value === undefined) return ""
    // 3 decimales alcanzan para kg y tasas; evita ruido de punto flotante.
    const raw = String(Number(value.toFixed(3)))
    return esAr ? raw.replace(".", ",") : raw
}

// dd/mm/aaaa hh:mm en ART (Excel es-AR) o ISO cuando el separador es coma.
function formatDate(value: string | null, esAr: boolean): string {
    if (!value) return ""
    if (!esAr) return value
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return value
    const parts = new Intl.DateTimeFormat("es-AR", {
        timeZone: APP_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((item) => item.type === type)?.value ?? ""
    return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`
}

// Escape RFC 4180: envuelve en comillas dobles si el campo contiene el
// separador, comillas o saltos de línea. Comillas internas se duplican.
function csvEscape(value: string, delimiter: ReportDelimiter): string {
    if (value.includes(delimiter) || /["\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

function sanitize(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64)
}

function buildFilenameStem(filters: ReportFilters): string {
    const desde = filters.desde?.slice(0, 10) || "inicio"
    const hasta = filters.hasta?.slice(0, 10) || "hoy"
    const parts = ["reporte-lotes", `${desde}_a_${hasta}`]
    if (filters.sectorId) parts.push(sanitize(filters.sectorId))
    if (filters.productoId) parts.push(sanitize(filters.productoId))
    return parts.filter(Boolean).join("-")
}
