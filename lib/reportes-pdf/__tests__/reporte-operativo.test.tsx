import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"

import { ReporteOperativo, buildLinePath } from "@/lib/reportes-pdf/reporte-operativo"
import {
  formatDate,
  formatDateTime,
  formatKg,
  formatNumber,
  formatPercent,
  scaleLinear,
} from "@/lib/reportes-pdf/palette"
import type { ReporteOEE } from "@/lib/oee-types"
import type { ReporteLote, ReporteResumen } from "@/lib/reportes-types"

function buildResumen(empty = false): ReporteResumen {
  return {
    periodo: {
      desde: "2026-01-01",
      hasta: "2026-01-03",
      timezone: "America/Argentina/Buenos_Aires",
    },
    filtros: { sector_id: null, producto_id: null, turno: null },
    produccion: {
      lotes_total: empty ? 0 : 12,
      lotes_cerrados: empty ? 0 : 10,
      lotes_abiertos: empty ? 0 : 2,
      unidades: empty ? 0 : 1200,
      unidades_ok: empty ? 0 : 1100,
      unidades_crudas: empty ? 0 : 60,
      unidades_quemadas: empty ? 0 : 40,
      kg_total_estimados: empty ? 0 : 1200.5,
      kg_ok_estimados: empty ? 0 : 1100.2,
      kg_merma_estimados: empty ? 0 : 100.3,
      duracion_media_min: empty ? null : 42.4,
      duracion_p95_min: empty ? null : 65,
      unidades_por_hora: empty ? null : 90,
      kg_por_hora: empty ? null : 88.2,
      por_turno: empty
        ? []
        : [
            { clave: "mañana", nombre: "Mañana", lotes: 5, unidades: 500, kg_estimados: 500, fpy_pct: 92 },
            { clave: "tarde", nombre: "Tarde", lotes: 7, unidades: 700, kg_estimados: 700.5, fpy_pct: 90.4 },
          ],
      por_sector: [],
      por_producto: [],
    },
    calidad: {
      fpy_pct: empty ? null : 91.7,
      crudo_pct: empty ? null : 5,
      quemado_pct: empty ? null : 3.3,
      confianza_promedio: empty ? null : 87.5,
      lotes_conformes_pct: empty ? null : 88.9,
      serie_diaria: empty
        ? []
        : [
            { fecha: "2026-01-01", lotes: 4, unidades: 400, kg_estimados: 400, fpy_pct: 92, crudo_pct: 5, quemado_pct: 3 },
            { fecha: "2026-01-02", lotes: 4, unidades: 400, kg_estimados: 400, fpy_pct: 90, crudo_pct: 6, quemado_pct: 4 },
            { fecha: "2026-01-03", lotes: 4, unidades: 400, kg_estimados: 400.5, fpy_pct: 93, crudo_pct: 4, quemado_pct: 3 },
          ],
    },
    proceso: {
      temp_mae_c: empty ? null : 1.7,
      temp_en_tolerancia_pct: empty ? null : 94.2,
      vel_mae: empty ? null : 0.3,
      vel_en_tolerancia_pct: empty ? null : 96.1,
      serie_diaria: empty
        ? []
        : [
            { fecha: "2026-01-01", temp_real_prom: 180.2, temp_objetivo_prom: 180, temp_en_tolerancia_pct: 95 },
            { fecha: "2026-01-02", temp_real_prom: 181.1, temp_objetivo_prom: 180, temp_en_tolerancia_pct: 93 },
            { fecha: "2026-01-03", temp_real_prom: 179.4, temp_objetivo_prom: 180, temp_en_tolerancia_pct: 97 },
          ],
    },
    alertas: {
      total: empty ? 0 : 6,
      por_severidad: empty ? {} : { critica: 1, alta: 3, media: 2 },
      por_tipo: empty ? [] : [{ clave: "temperatura", total: 4 }, { clave: "velocidad", total: 2 }],
      ack_pct: empty ? null : 66.7,
      mtta_min: empty ? null : 4.2,
      serie_diaria: [],
    },
    automatizacion: {
      decisiones_total: empty ? 0 : 20,
      mpc_pct: empty ? null : 70,
      operario_pct: empty ? null : 20,
      sin_aplicar_pct: empty ? null : 10,
      z_mae: empty ? null : 0.4,
      top_skip: empty ? [] : [{ clave: "sin_lote", total: 2 }],
      modo_pct: empty ? {} : { AUTOMATICO: 70, SUPERVISION: 20, MANUAL: 10 },
    },
  }
}

function buildOEE(calculable = true): ReporteOEE {
  const resumen = {
    sector_id: "s-1",
    sector_nombre: "Sector 1",
    calculable,
    motivos: calculable ? [] : ["sin_plan_produccion", "sin_capacidad_producto:p-1"],
    availability_pct: calculable ? 92.5 : null,
    performance_pct: calculable ? 87.2 : null,
    quality_pct: calculable ? 96.1 : null,
    oee_pct: calculable ? 77.6 : null,
    planned_time_min: 1440,
    planned_downtime_min: 60,
    unplanned_downtime_min: 120,
    operating_time_min: 1260,
    kg_plan: 1500,
    kg_producidos: 1400,
    kg_ok: 1346,
    capacidad_teorica_kg: 1600,
    energy: {
      kwh: 620.5,
      gas_m3: 310.4,
      kwh_por_kg_ok: 0.46,
      gas_m3_por_kg_ok: 0.23,
    },
  }
  return {
    periodo: {
      desde: "2026-01-01",
      hasta: "2026-01-03",
      timezone: "America/Argentina/Buenos_Aires",
    },
    filtros: { sector_id: "s-1" },
    global: resumen,
    por_sector: [
      resumen,
      { ...resumen, sector_id: "s-2", sector_nombre: "Sector 2", oee_pct: 70.1 },
    ],
  }
}

function buildLote(id: string): ReporteLote {
  return {
    id,
    sector_id: "s-1",
    sector_nombre: "Sector 1",
    producto_id: "p-1",
    producto_nombre: "Producto 1",
    turno: "mañana",
    estado: "cerrado",
    abierto_en: "2026-01-02T10:05:00-03:00",
    cerrado_en: "2026-01-02T11:00:00-03:00",
    motivo_cierre: null,
    modo: "AUTOMATICO",
    conteos: { ok: 95, crudo: 3, quemado: 2, total: 100 },
    kg: { ok: 95, crudo: 3, quemado: 2, total: 100, merma: 5 },
    confianza_promedio: 88.5,
    duracion_min: 55,
    fpy_pct: 95,
    crudo_pct: 3,
    quemado_pct: 2,
  }
}

describe("helpers del PDF operativo", () => {
  it("formatea con locale es-AR y null como raya", () => {
    expect(formatNumber(1234)).toBe("1.234")
    expect(formatPercent(91.74)).toBe("91,7%")
    expect(formatPercent(null)).toBe("—")
    expect(formatKg(10.25)).toBe("10,3 kg")
    expect(formatKg(null)).toBe("—")
  })

  it("no corre la fecha de un día calendario al mostrarla en ART", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026")
    expect(formatDateTime("2026-01-02T10:05:00-03:00")).toBe("02/01/2026 10:05")
  })

  it("escala de forma lineal y clampeada sin dividir por cero", () => {
    expect(scaleLinear(50, 0, 100, 200)).toBe(100)
    expect(scaleLinear(-10, 0, 100, 200)).toBe(0)
    expect(scaleLinear(150, 0, 100, 200)).toBe(200)
    expect(scaleLinear(10, 10, 10, 200)).toBe(100)
  })

  it("corta la línea en valores nulos", () => {
    const path = buildLinePath([1, null, 3], 100, 100, 0, 4)
    expect(path.startsWith("M")).toBe(true)
    expect(path.match(/M/g)).toHaveLength(2)
  })
})

describe("ReporteOperativo", () => {
  it("genera un PDF con resumen y detalle", async () => {
    const buffer = await renderToBuffer(
      <ReporteOperativo
        resumen={buildResumen()}
        lotes={[buildLote("l-1"), buildLote("l-2")]}
        filtros={{ sector_id: "s-1", producto_id: null, turno: "mañana" }}
        generatedAt={new Date("2026-01-04T12:00:00-03:00")}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it("no rompe cuando el período está vacío", async () => {
    const buffer = await renderToBuffer(
      <ReporteOperativo
        resumen={buildResumen(true)}
        lotes={[]}
        filtros={{ sector_id: null, producto_id: null, turno: null }}
        generatedAt={new Date("2026-01-04T12:00:00-03:00")}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("incluye la página de OEE cuando el período es calculable", async () => {
    const buffer = await renderToBuffer(
      <ReporteOperativo
        resumen={buildResumen()}
        lotes={[buildLote("l-1")]}
        filtros={{ sector_id: "s-1", producto_id: null, turno: null }}
        generatedAt={new Date("2026-01-04T12:00:00-03:00")}
        oee={buildOEE()}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(4000)
  })

  it("muestra el callout cuando el OEE no es calculable", async () => {
    const buffer = await renderToBuffer(
      <ReporteOperativo
        resumen={buildResumen()}
        lotes={[buildLote("l-1")]}
        filtros={{ sector_id: "s-1", producto_id: null, turno: null }}
        generatedAt={new Date("2026-01-04T12:00:00-03:00")}
        oee={buildOEE(false)}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(4000)
  })

  it("no rompe cuando el OEE no está disponible", async () => {
    const buffer = await renderToBuffer(
      <ReporteOperativo
        resumen={buildResumen()}
        lotes={[buildLote("l-1")]}
        filtros={{ sector_id: "s-1", producto_id: null, turno: null }}
        generatedAt={new Date("2026-01-04T12:00:00-03:00")}
        oee={null}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(4000)
  })
})
