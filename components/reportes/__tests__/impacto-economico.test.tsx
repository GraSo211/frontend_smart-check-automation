import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ImpactoEconomicoCard } from "@/components/reportes/impacto-economico"
import type { ImpactoEconomico } from "@/lib/economia-merma"

const data: ImpactoEconomico = {
  moneda: "ARS", referencia_costo: "actual_producto", perdida_ars: 1255,
  perdida_valorizada_ars: 1255, unidades_merma: 10, unidades_sin_costo: 0,
  lotes_sin_conteos: 0, por_producto: [{ producto_id: "pan", nombre: "Pan", costo_unitario_ars: 125.50, unidades_merma: 10, lotes_sin_conteos: 0, perdida_ars: 1255 }],
}

describe("KPI de impacto económico", () => {
  it("muestra importe, variedad, costo y fórmula de cálculo", () => {
    const html = renderToStaticMarkup(<ImpactoEconomicoCard data={data} periodo="Noviembre" />)
    expect(html).toContain("1.255,00")
    expect(html).toContain("125,50")
    expect(html).toContain("ARS")
    expect(html).toContain("Pan")
    expect(html).toContain("costo unitario actual")
    expect(html).not.toContain("Cálculo incompleto")
  })
  it("advierte costos y conteos faltantes sin mostrar un total falso", () => {
    const html = renderToStaticMarkup(<ImpactoEconomicoCard data={{ ...data, perdida_ars: null, unidades_sin_costo: 10, lotes_sin_conteos: 1 }} />)
    expect(html).toContain("Cálculo incompleto")
    expect(html).toContain("10 piezas de merma sin valorizar")
    expect(html).toContain("1 lote sin conteos")
    expect(html).toContain("Revisar costos de fabricación")
  })
  it("conserva la última consulta con aviso si el refresco falla", () => {
    const html = renderToStaticMarkup(<ImpactoEconomicoCard data={data} error="API caída" />)
    expect(html).toContain("1.255,00")
    expect(html).toContain("última consulta confirmada")
    expect(renderToStaticMarkup(<ImpactoEconomicoCard error="API caída" />)).not.toContain("0,00 ARS")
  })
})
