import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"

import { ReporteTrazabilidad } from "@/lib/reportes-pdf/trazabilidad"
import type {
  ReporteTrazabilidad as ReporteTrazabilidadData,
  ReporteTrazabilidadLote,
} from "@/lib/reportes-types"

function buildLote(): ReporteTrazabilidadLote {
  return {
    id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    sector_id: "horno-1",
    sector_nombre: "Sector 1",
    producto_id: "b2c3d4e5-6789-0abc-def1-234567890abc",
    producto_nombre: "Tostada Integral",
    turno: "mañana",
    estado: "CERRADO",
    abierto_en: "2026-11-04T10:00:00-03:00",
    cerrado_en: "2026-11-04T11:00:00-03:00",
    motivo_cierre: "manual",
    modo: "AUTOMATICO",
    conteos: { ok: 90, crudo: 6, quemado: 4, total: 100 },
    kg: { ok: 22.5, crudo: 1.5, quemado: 1, total: 25, merma: 2.5 },
    confianza_promedio: 0.8,
    duracion_min: 60,
    fpy_pct: 90,
    crudo_pct: 6,
    quemado_pct: 4,
    temp1_objetivo: 180,
    vel_objetivo: 0.2,
    tolerancia_temp_c: 2,
    umbral_aceptacion_crudo: 5,
    umbral_aceptacion_quemado: 5,
    delta_temp1_max_c: null,
    delta_vel_max: null,
  }
}

function buildData(): ReporteTrazabilidadData {
  return {
    lote: buildLote(),
    proceso: {
      temp_mae_c: 1.2,
      temp_en_tolerancia_pct: 88.5,
      vel_mae: 0.012,
      vel_en_tolerancia_pct: 91.2,
      serie: [
        {
          ts: "2026-11-04T10:00:00-03:00",
          temp_real: 181.2,
          temp_objetivo: 180,
          vel_real: 0.2,
          vel_objetivo: 0.2,
          muestras: 12,
        },
        {
          ts: "2026-11-04T10:05:00-03:00",
          temp_real: 179.4,
          temp_objetivo: 180,
          vel_real: 0.19,
          vel_objetivo: 0.2,
          muestras: 12,
        },
      ],
    },
    confianza_clases: [
      { clase: "ok", confianza_media: 0.9, confianza_stddev: 0.05, muestras: 100 },
      { clase: "crudo", confianza_media: 0.7, confianza_stddev: null, muestras: 6 },
    ],
    decisiones: [
      {
        id: "d1e2f3a4-5678-90ab-cdef-1234567890ab",
        creada_en: "2026-11-04T10:05:00-03:00",
        ventana_inicio: "2026-11-04T10:00:00-03:00",
        ventana_fin: "2026-11-04T10:05:00-03:00",
        muestras: 30,
        temp_actual: 180,
        vel_actual: 0.2,
        pct_ok_obs: 95,
        pct_crudos_obs: 2,
        pct_quemados_obs: 3,
        conf_promedio: 0.9,
        temp_propuesto: 181,
        vel_propuesto: 0.2,
        temp_aplicado: 181,
        vel_aplicado: 0.2,
        z_observado: 0.2,
        z_predicho: 0.3,
        razon_skipped: null,
        aplicado_por: "MPC",
        aprobada_por: null,
        aprobada_at: null,
      },
    ],
    consignas: [
      {
        id: "c1d2e3f4-5678-90ab-cdef-1234567890ab",
        creada_en: "2026-11-04T10:00:00-03:00",
        temperatura_objetivo: 180,
        velocidad_cinta_objetivo: 0.2,
        origen: "MANUAL",
        usuario: "operario",
        exitosa: true,
        motivo_error: null,
        temperatura_previa: 179,
        velocidad_cinta_previa: 0.19,
      },
    ],
    alertas: [
      {
        id: "a1f2e3d4-5678-90ab-cdef-1234567890ab",
        creada_en: "2026-11-04T10:10:00-03:00",
        tipo: "TEMPERATURA_HORNO",
        severidad: "CRITICAL",
        estado: "ACK",
        mensaje: "Temperatura fuera de rango",
        acked_at: "2026-11-04T10:12:00-03:00",
      },
    ],
    generado_en: "2026-11-04T11:05:00-03:00",
  }
}

function buildEmptyData(): ReporteTrazabilidadData {
  return {
    lote: {
      ...buildLote(),
      estado: "ABIERTO",
      cerrado_en: null,
      motivo_cierre: null,
      modo: null,
      turno: null,
      confianza_promedio: null,
      fpy_pct: null,
      crudo_pct: null,
      quemado_pct: null,
      temp1_objetivo: null,
      vel_objetivo: null,
      tolerancia_temp_c: null,
      umbral_aceptacion_crudo: null,
      umbral_aceptacion_quemado: null,
    },
    proceso: {
      temp_mae_c: null,
      temp_en_tolerancia_pct: null,
      vel_mae: null,
      vel_en_tolerancia_pct: null,
      serie: [],
    },
    confianza_clases: [],
    decisiones: [],
    consignas: [],
    alertas: [],
    generado_en: "2026-11-04T11:05:00-03:00",
  }
}

describe("ReporteTrazabilidad", () => {
  it("genera un PDF con todos los bloques", async () => {
    const buffer = await renderToBuffer(
      <ReporteTrazabilidad
        data={buildData()}
        generatedAt={new Date("2026-11-04T12:00:00-03:00")}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it("no rompe cuando todos los arrays están vacíos", async () => {
    const buffer = await renderToBuffer(
      <ReporteTrazabilidad
        data={buildEmptyData()}
        generatedAt={new Date("2026-11-04T12:00:00-03:00")}
      />,
    )
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
