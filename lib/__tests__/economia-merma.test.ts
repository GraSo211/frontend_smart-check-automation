import { describe, expect, it } from "vitest"
import { formatARS, formatImpactoMerma, isImpactoEconomico, type ImpactoEconomico } from "@/lib/economia-merma"

const completo: ImpactoEconomico = {
  moneda: "ARS", referencia_costo: "actual_producto", perdida_ars: 1255,
  perdida_valorizada_ars: 1255, unidades_merma: 10, unidades_sin_costo: 0,
  lotes_sin_conteos: 0, por_producto: [],
}

describe("valorización de merma", () => {
  it("formatea pesos argentinos con símbolo, miles y centavos", () => {
    expect(formatARS(1234.5).replace(/\s/g, " ")).toBe("$ 1.234,50 ARS")
    expect(formatARS(0)).toContain("0,00")
    expect(formatARS(null)).toBe("—")
    expect(formatARS(Number.NaN)).toBe("—")
  })
  it("identifica subtotales y no convierte costos faltantes en cero", () => {
    expect(formatImpactoMerma(completo)).toContain("1.255,00")
    expect(formatImpactoMerma({ ...completo, perdida_ars: null, unidades_sin_costo: 2 })).toContain("(parcial)")
    expect(formatImpactoMerma({ ...completo, perdida_ars: null, unidades_sin_costo: 10 })).toBe("—")
    expect(formatImpactoMerma({ ...completo, perdida_ars: 0 })).toContain("0,00")
    expect(formatImpactoMerma(undefined)).toBe("—")
  })
  it("valida moneda, importes, conteos y desglose de la API", () => {
    expect(isImpactoEconomico(completo)).toBe(true)
    for (const bad of [{ moneda: "USD" }, { perdida_ars: -1 }, { unidades_merma: 1.5 }, { perdida_valorizada_ars: Infinity }, { por_producto: [{}] }]) {
      expect(isImpactoEconomico({ ...completo, ...bad })).toBe(false)
    }
  })
})
