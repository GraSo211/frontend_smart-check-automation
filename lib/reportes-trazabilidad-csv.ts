import type {
  ReporteTrazabilidad,
  ReporteTrazabilidadAlerta,
  ReporteTrazabilidadConsigna,
  ReporteTrazabilidadDecision,
  ReporteTrazabilidadPunto,
} from "@/lib/reportes-types"
import { APP_TIME_ZONE } from "@/lib/format"

export type TrazabilidadDataset =
  | "proceso"
  | "alertas"
  | "decisiones"
  | "consignas"

export type TrazabilidadDelimiter = "," | ";"

export interface BuiltTrazabilidadCsv {
  body: string
  contentType: string
  filename: string
  rows: number
}

const HEADERS: Record<TrazabilidadDataset, readonly string[]> = {
  proceso: ["ts", "temp_real", "temp_objetivo", "vel_real", "vel_objetivo", "muestras"],
  alertas: ["creada_en", "tipo", "severidad", "estado", "mensaje", "acked_at"],
  decisiones: [
    "creada_en",
    "ventana_inicio",
    "ventana_fin",
    "muestras",
    "temp_actual",
    "vel_actual",
    "pct_ok_obs",
    "pct_crudos_obs",
    "pct_quemados_obs",
    "conf_promedio",
    "temp_propuesto",
    "vel_propuesto",
    "temp_aplicado",
    "vel_aplicado",
    "z_observado",
    "z_predicho",
    "razon_skipped",
    "aplicado_por",
    "aprobada_por",
    "aprobada_at",
  ],
  consignas: [
    "creada_en",
    "origen",
    "temperatura_objetivo",
    "velocidad_cinta_objetivo",
    "temperatura_previa",
    "velocidad_cinta_previa",
    "exitosa",
    "motivo_error",
    "usuario",
  ],
}

export function isTrazabilidadDataset(
  value: string,
): value is TrazabilidadDataset {
  return Object.prototype.hasOwnProperty.call(HEADERS, value)
}

/**
 * Genera el CSV de un dataset de trazabilidad a partir del JSON que ya devolvió
 * GET /api/v1/reportes/trazabilidad. Puro: no hace fetch.
 */
export function buildTrazabilidadCsv(
  data: ReporteTrazabilidad,
  dataset: TrazabilidadDataset,
  opts?: { delimiter?: TrazabilidadDelimiter },
): BuiltTrazabilidadCsv {
  const delimiter = opts?.delimiter === ";" ? ";" : ","
  const esAr = delimiter === ";"
  const lines = [HEADERS[dataset].join(delimiter)]

  for (const row of rowsFor(data, dataset)) {
    lines.push(
      row.map((cell) => buildCell(cell, delimiter, esAr)).join(delimiter),
    )
  }

  const body = "\uFEFF" + lines.join("\r\n") + "\r\n"
  return {
    body,
    contentType: "text/csv; charset=utf-8",
    filename: `trazabilidad-${data.lote.id}-${dataset}.csv`,
    rows: lines.length - 1,
  }
}

type Cell = string | number | boolean | null

function rowsFor(
  data: ReporteTrazabilidad,
  dataset: TrazabilidadDataset,
): Cell[][] {
  switch (dataset) {
    case "proceso":
      return data.proceso.serie.map((p: ReporteTrazabilidadPunto) => [
        p.ts,
        p.temp_real,
        p.temp_objetivo,
        p.vel_real,
        p.vel_objetivo,
        p.muestras,
      ])
    case "alertas":
      return data.alertas.map((a: ReporteTrazabilidadAlerta) => [
        a.creada_en,
        a.tipo,
        a.severidad,
        a.estado,
        a.mensaje,
        a.acked_at,
      ])
    case "decisiones":
      return data.decisiones.map((d: ReporteTrazabilidadDecision) => [
        d.creada_en,
        d.ventana_inicio,
        d.ventana_fin,
        d.muestras,
        d.temp_actual,
        d.vel_actual,
        d.pct_ok_obs,
        d.pct_crudos_obs,
        d.pct_quemados_obs,
        d.conf_promedio,
        d.temp_propuesto,
        d.vel_propuesto,
        d.temp_aplicado,
        d.vel_aplicado,
        d.z_observado,
        d.z_predicho,
        d.razon_skipped,
        d.aplicado_por,
        d.aprobada_por,
        d.aprobada_at,
      ])
    case "consignas":
      return data.consignas.map((c: ReporteTrazabilidadConsigna) => [
        c.creada_en,
        c.origen,
        c.temperatura_objetivo,
        c.velocidad_cinta_objetivo,
        c.temperatura_previa,
        c.velocidad_cinta_previa,
        c.exitosa,
        c.motivo_error,
        c.usuario,
      ])
  }
}

function buildCell(
  value: Cell,
  delimiter: TrazabilidadDelimiter,
  esAr: boolean,
): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return formatNumber(value, esAr)
  if (typeof value === "boolean") return value ? "true" : "false"
  return csvEscape(neutralize(formatDate(value, esAr)), delimiter)
}

// Neutraliza fórmulas de hoja de cálculo en strings.
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function formatNumber(value: number, esAr: boolean): string {
  const raw = String(Number(value.toFixed(3)))
  return esAr ? raw.replace(".", ",") : raw
}

// dd/mm/aaaa hh:mm en ART (Excel es-AR) o ISO cuando el separador es coma.
function formatDate(value: string, esAr: boolean): string {
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
function csvEscape(value: string, delimiter: TrazabilidadDelimiter): string {
  if (value.includes(delimiter) || /["\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
