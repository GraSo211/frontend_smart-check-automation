import Link from "next/link"
import { formatARS, formatImpactoMerma, REFERENCIA_COSTO_MERMA, type ImpactoEconomico } from "@/lib/economia-merma"
import { formatNumber } from "@/lib/format"

export function ImpactoEconomicoCard({ data, periodo, error, detalle = true }: {
  data?: ImpactoEconomico | null
  periodo?: string
  error?: string | null
  detalle?: boolean
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-label="Impacto económico de la merma">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Impacto económico de la merma</h2>
          {periodo && <p className="mt-1 text-xs text-muted-foreground">{periodo}</p>}
        </div>
        {data?.perdida_ars === null && <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">Cálculo incompleto</span>}
      </div>
      <p className="mt-5 break-words font-mono text-3xl font-semibold tracking-tight text-destructive sm:text-4xl">{formatImpactoMerma(data)}</p>
      {error ? <p role="status" className="mt-3 text-sm text-warning">No se pudo actualizar el impacto económico. {data ? "Se conserva la última consulta confirmada." : error}</p> : null}
      {!data && !error && <p role="status" className="mt-3 text-sm text-muted-foreground">El impacto económico no está disponible.</p>}
      {data && <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p>{formatNumber(data.unidades_merma)} piezas defectuosas registradas.</p>
        {data.por_producto.length === 0 && <p>Sin lotes registrados en este período.</p>}
        {data.unidades_sin_costo > 0 && <p>{formatNumber(data.unidades_sin_costo)} piezas de merma sin valorizar: falta configurar el costo de su producto.</p>}
        {data.lotes_sin_conteos > 0 && <p>{formatNumber(data.lotes_sin_conteos)} {data.lotes_sin_conteos === 1 ? "lote sin conteos" : "lotes sin conteos"} de defectos; su merma no se estima.</p>}
        {data.unidades_sin_costo > 0 && <Link href="/configuracion" className="inline-block font-medium text-primary underline underline-offset-4">Revisar costos de fabricación</Link>}
      </div>}
      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{REFERENCIA_COSTO_MERMA}</p>
      {detalle && data && data.por_producto.length > 0 && <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Ver desglose por producto</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Merma valorizada por variedad de producto en pesos argentinos</caption>
            <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="p-2">Producto</th><th scope="col" className="p-2 text-right">Costo por pieza</th><th scope="col" className="p-2 text-right">Merma (piezas)</th><th scope="col" className="p-2 text-right">Pérdida</th></tr></thead>
            <tbody>{data.por_producto.map((p) => <tr key={p.producto_id} className="border-b border-border/50">
              <th scope="row" className="p-2 font-medium">{p.nombre}{p.lotes_sin_conteos > 0 && <span className="block text-xs font-normal text-warning">{p.lotes_sin_conteos} {p.lotes_sin_conteos === 1 ? "lote sin conteos" : "lotes sin conteos"}</span>}</th>
              <td className="whitespace-nowrap p-2 text-right tabular-nums">{p.costo_unitario_ars == null ? "Sin configurar" : formatARS(p.costo_unitario_ars)}</td>
              <td className="p-2 text-right tabular-nums">{formatNumber(p.unidades_merma)}</td>
              <td className="whitespace-nowrap p-2 text-right tabular-nums">{formatARS(p.perdida_ars)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>}
    </section>
  )
}
