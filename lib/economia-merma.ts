import type { ReporteEconomico } from "@/lib/reportes-types"

export type MermaProducto = {
  producto_id: string
  nombre: string
  costo_unitario_ars: number | null
  unidades_merma: number
  lotes_sin_conteos: number
  perdida_ars: number | null
}

export type ImpactoEconomico = {
  moneda: "ARS"
  referencia_costo: "actual_producto"
  perdida_ars: number | null
  perdida_valorizada_ars: number
  unidades_merma: number
  unidades_sin_costo: number
  lotes_sin_conteos: number
  por_producto: MermaProducto[]
}

export function formatARS(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ARS`
}

export function formatImpactoMerma(data: ImpactoEconomico | null | undefined): string {
  if (!data) return "—"
  if (data.perdida_ars !== null) return formatARS(data.perdida_ars)
  return data.unidades_merma > data.unidades_sin_costo
    ? `${formatARS(data.perdida_valorizada_ars)} (parcial)`
    : "—"
}

export const REFERENCIA_COSTO_MERMA = "Piezas crudas + quemadas × costo unitario actual de cada producto. Incluye lotes abiertos y cerrados iniciados en el período. Cambiar el costo recalcula la valorización; no es un costo histórico ni incluye merma no detectada."

export function isImpactoEconomico(value: unknown): value is ImpactoEconomico {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  const number = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0
  const count = (x: unknown) => number(x) && Number.isSafeInteger(x)
  const money = (x: unknown) => x === null || number(x)
  return v.moneda === "ARS" && v.referencia_costo === "actual_producto" &&
    money(v.perdida_ars) && number(v.perdida_valorizada_ars) &&
    count(v.unidades_merma) && count(v.unidades_sin_costo) && count(v.lotes_sin_conteos) &&
    Array.isArray(v.por_producto) && v.por_producto.every((p: unknown) => {
      if (!p || typeof p !== "object") return false
      const row = p as Record<string, unknown>
      return typeof row.producto_id === "string" && typeof row.nombre === "string" &&
        money(row.costo_unitario_ars) && money(row.perdida_ars) && count(row.unidades_merma) && count(row.lotes_sin_conteos)
    })
}

export function isReporteEconomico(value: unknown): value is ReporteEconomico {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  if (!v.periodo || typeof v.periodo !== "object" || !v.filtros || typeof v.filtros !== "object") return false
  const p = v.periodo as Record<string, unknown>
  const f = v.filtros as Record<string, unknown>
  return typeof p.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.desde) &&
    typeof p.hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.hasta) && typeof p.timezone === "string" &&
    [f.sector_id, f.producto_id, f.turno].every((x) => x === null || typeof x === "string") && isImpactoEconomico(v.impacto_economico)
}
