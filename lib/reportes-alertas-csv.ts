import type { ReporteAlerta, ReporteAlertasData } from "@/lib/reportes-types"
import { APP_TIME_ZONE } from "@/lib/format"

export type AlertasReportFormat = "csv" | "json"

export type AlertasDelimiter = "," | ";"

export type AlertasReportFilters = {
  desde?: string | null
  hasta?: string | null
  sectorId?: string | null
  productoId?: string | null
  turno?: string | null
  estado?: string | null
}

export interface AlertasReportData extends ReporteAlertasData {
  filtros?: AlertasReportFilters
}

export interface BuiltAlertasReport {
  body: string
  contentType: string
  filename: string
  rows: number
}

const CSV_HEADER = [
  "id",
  "creada_en",
  "sector_id",
  "sector_nombre",
  "lote_id",
  "producto_id",
  "producto_nombre",
  "turno",
  "tipo",
  "severidad",
  "estado",
  "mensaje",
  "acked_at",
  "acked_por",
  "mtta_min",
] as const

/**
 * Genera el archivo (CSV o JSON) de alertas del período a partir de lo que ya
 * devolvió GET /api/v1/reportes/alertas. Puro: no hace fetch.
 */
export function buildAlertasReport(
  data: AlertasReportData,
  opts?: { format?: AlertasReportFormat; delimiter?: AlertasDelimiter },
): BuiltAlertasReport {
  const format = opts?.format === "json" ? "json" : "csv"
  const delimiter: AlertasDelimiter = opts?.delimiter === ";" ? ";" : ","
  const stem = buildFilenameStem(data.filtros)

  if (format === "json") {
    return {
      body: JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          total: data.total,
          truncada: data.truncada,
          filtros: {
            desde: data.filtros?.desde ?? null,
            hasta: data.filtros?.hasta ?? null,
            sector_id: data.filtros?.sectorId ?? null,
            producto_id: data.filtros?.productoId ?? null,
            turno: data.filtros?.turno ?? null,
            estado: data.filtros?.estado ?? null,
          },
          alertas: data.alertas,
        },
        null,
        2,
      ),
      contentType: "application/json; charset=utf-8",
      filename: `${stem}.json`,
      rows: data.alertas.length,
    }
  }

  const esAr = delimiter === ";"
  const lines = [CSV_HEADER.join(delimiter)]
  for (const alerta of data.alertas) {
    lines.push(buildRow(alerta, delimiter, esAr).join(delimiter))
  }
  return {
    body: "\uFEFF" + lines.join("\r\n") + "\r\n",
    contentType: "text/csv; charset=utf-8",
    filename: `${stem}.csv`,
    rows: data.alertas.length,
  }
}

function buildRow(
  a: ReporteAlerta,
  delimiter: AlertasDelimiter,
  esAr: boolean,
): string[] {
  return [
    text(a.id, delimiter),
    text(formatDate(a.creada_en, esAr), delimiter),
    text(a.sector_id, delimiter),
    text(a.sector_nombre, delimiter),
    text(a.lote_id, delimiter),
    text(a.producto_id, delimiter),
    text(a.producto_nombre, delimiter),
    text(a.turno, delimiter),
    text(a.tipo, delimiter),
    text(a.severidad, delimiter),
    text(a.estado, delimiter),
    text(a.mensaje, delimiter),
    text(formatDate(a.acked_at, esAr), delimiter),
    text(a.acked_por, delimiter),
    formatNumber(a.mtta_min, esAr),
  ]
}

// Neutraliza fórmulas de hoja de cálculo en strings. Los números no se tocan.
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function text(value: string | null, delimiter: AlertasDelimiter): string {
  if (value === null || value === undefined) return ""
  return csvEscape(neutralize(value), delimiter)
}

function formatNumber(value: number | null, esAr: boolean): string {
  if (value === null || value === undefined) return ""
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

// Escape RFC 4180: comillas dobles si el campo contiene separador, comillas o
// saltos de línea. Comillas internas se duplican.
function csvEscape(value: string, delimiter: AlertasDelimiter): string {
  if (value.includes(delimiter) || /["\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildFilenameStem(filtros?: AlertasReportFilters): string {
  const desde = filtros?.desde?.slice(0, 10) || "inicio"
  const hasta = filtros?.hasta?.slice(0, 10) || "hoy"
  return `reporte-alertas-${desde}_a_${hasta}`
}
