import { describe, expect, it } from "vitest"

import {
  buildTrazabilidadCsv,
  isTrazabilidadDataset,
  type TrazabilidadDataset,
} from "@/lib/reportes-trazabilidad-csv"
import type { ReporteTrazabilidad } from "@/lib/reportes-types"

const data: ReporteTrazabilidad = {
  lote: { id: "lote-1" } as unknown as ReporteTrazabilidad["lote"],
  proceso: {
    temp_mae_c: null,
    temp_en_tolerancia_pct: null,
    vel_mae: null,
    vel_en_tolerancia_pct: null,
    serie: [
      {
        ts: "2026-01-02T03:04:05Z",
        temp_real: 45.6,
        temp_objetivo: null,
        vel_real: 1.25,
        vel_objetivo: 1.5,
        muestras: 12,
      },
    ],
  },
  confianza_clases: [],
  decisiones: [
    {
      id: "d-1",
      creada_en: "2026-01-02T03:04:05Z",
      ventana_inicio: "2026-01-02T03:00:00Z",
      ventana_fin: "2026-01-02T03:04:00Z",
      muestras: 10,
      temp_actual: 45.5,
      vel_actual: 1.2,
      pct_ok_obs: 90,
      pct_crudos_obs: null,
      pct_quemados_obs: 5,
      conf_promedio: 0.87,
      temp_propuesto: 46,
      vel_propuesto: null,
      temp_aplicado: 46,
      vel_aplicado: null,
      z_observado: 1.1,
      z_predicho: 0.9,
      razon_skipped: null,
      aplicado_por: "auto",
      aprobada_por: null,
      aprobada_at: null,
    },
  ],
  consignas: [
    {
      id: "c-1",
      creada_en: "2026-01-02T03:04:05Z",
      temperatura_objetivo: 46,
      velocidad_cinta_objetivo: 1.4,
      origen: "manual",
      usuario: "op-1",
      exitosa: true,
      estado: "PENDIENTE",
      decision_id: "c1d2e3f4-0000-0000-0000-000000000000",
      motivo_error: null,
      temperatura_previa: 44,
      velocidad_cinta_previa: 1.3,
    },
  ],
  alertas: [
    {
      id: "a-1",
      creada_en: "2026-01-02T03:04:05Z",
      tipo: "TEMP_ALTA",
      severidad: "critica",
      estado: "activa",
      mensaje: "=SUM(A1)",
      acked_at: null,
    },
  ],
  generado_en: "2026-01-02T03:05:00Z",
}

const DATASETS: TrazabilidadDataset[] = [
  "proceso",
  "alertas",
  "decisiones",
  "consignas",
]

function lines(body: string): string[] {
  return body.replace(/^\uFEFF/, "").split("\r\n")
}

describe("buildTrazabilidadCsv", () => {
  it("usa el header exacto de cada dataset", () => {
    const expected: Record<TrazabilidadDataset, string> = {
      proceso:
        "ts,temp_real,temp_objetivo,vel_real,vel_objetivo,muestras",
      alertas: "creada_en,tipo,severidad,estado,mensaje,acked_at",
      decisiones:
        "creada_en,ventana_inicio,ventana_fin,muestras,temp_actual,vel_actual,pct_ok_obs,pct_crudos_obs,pct_quemados_obs,conf_promedio,temp_propuesto,vel_propuesto,temp_aplicado,vel_aplicado,z_observado,z_predicho,razon_skipped,aplicado_por,aprobada_por,aprobada_at",
      consignas:
        "creada_en,origen,temperatura_objetivo,velocidad_cinta_objetivo,temperatura_previa,velocidad_cinta_previa,exitosa,estado,decision_id,motivo_error,usuario",
    }
    for (const dataset of DATASETS) {
      expect(lines(buildTrazabilidadCsv(data, dataset).body)[0]).toBe(
        expected[dataset],
      )
    }
  })

  it("emite BOM UTF-8 y termina cada línea con CRLF", () => {
    const { body, contentType, rows } = buildTrazabilidadCsv(data, "proceso")
    expect(body.startsWith("\uFEFF")).toBe(true)
    expect(body.endsWith("\r\n")).toBe(true)
    expect(body).toContain("\r\n")
    expect(contentType).toBe("text/csv; charset=utf-8")
    expect(rows).toBe(1)
  })

  it("deja vacía la celda de un valor null", () => {
    const [, row] = lines(buildTrazabilidadCsv(data, "proceso").body)
    expect(row.split(",")).toEqual([
      "2026-01-02T03:04:05Z",
      "45.6",
      "",
      "1.25",
      "1.5",
      "12",
    ])
  })

  it("neutraliza fórmulas de inyección en strings", () => {
    const { body } = buildTrazabilidadCsv(data, "alertas")
    const [, row] = lines(body)
    expect(row.split(",")).toContain("'=SUM(A1)")
  })

  it("con delimiter ';' usa fechas ART y coma decimal", () => {
    const { body } = buildTrazabilidadCsv(data, "proceso", {
      delimiter: ";",
    })
    const [header, row] = lines(body)
    expect(header).toContain(";")
    expect(row.split(";")).toEqual([
      "02/01/2026 00:04",
      "45,6",
      "",
      "1,25",
      "1,5",
      "12",
    ])
  })

  it("arma el filename con lote y dataset", () => {
    expect(buildTrazabilidadCsv(data, "alertas").filename).toBe(
      "trazabilidad-lote-1-alertas.csv",
    )
  })

  it("valida los datasets conocidos", () => {
    expect(isTrazabilidadDataset("proceso")).toBe(true)
    expect(isTrazabilidadDataset("confianza")).toBe(false)
    // No debe aceptar propiedades heredadas del prototipo.
    expect(isTrazabilidadDataset("toString")).toBe(false)
    expect(isTrazabilidadDataset("constructor")).toBe(false)
  })
})
