import { describe, expect, it } from "vitest"

import {
  buildAlertasReport,
  type AlertasReportData,
} from "@/lib/reportes-alertas-csv"

const data: AlertasReportData = {
  total: 2,
  truncada: true,
  filtros: {
    desde: "2026-01-01",
    hasta: "2026-01-31",
    sectorId: "s-1",
    productoId: "p-1",
    turno: "tarde",
    estado: "ACK",
  },
  alertas: [
    {
      id: "a-1",
      creada_en: "2026-01-02T03:04:05Z",
      sector_id: "s-1",
      sector_nombre: "Sector 1",
      lote_id: "l-1",
      producto_id: "p-1",
      producto_nombre: "Tostada Integral",
      turno: "tarde",
      tipo: "TEMPERATURA_HORNO",
      severidad: "CRITICAL",
      estado: "ACK",
      mensaje: "=SUM(A1)",
      acked_at: "2026-01-02T04:04:05Z",
      acked_por: "admin@fermar.com.ar",
      mtta_min: 10.5,
    },
    {
      id: "a-2",
      creada_en: "2026-01-03T03:04:05Z",
      sector_id: "s-1",
      sector_nombre: "Sector 1",
      lote_id: "l-2",
      producto_id: "p-1",
      producto_nombre: "Tostada Integral",
      turno: null,
      tipo: "VELOCIDAD_CINTA",
      severidad: "WARNING",
      estado: "ACTIVA",
      mensaje: "sin datos",
      acked_at: null,
      acked_por: null,
      mtta_min: null,
    },
  ],
}

function lines(body: string): string[] {
  return body.replace(/^\uFEFF/, "").split("\r\n")
}

describe("buildAlertasReport", () => {
  it("usa el header exacto de columnas", () => {
    expect(lines(buildAlertasReport(data).body)[0]).toBe(
      "id,creada_en,sector_id,sector_nombre,lote_id,producto_id,producto_nombre,turno,tipo,severidad,estado,mensaje,acked_at,acked_por,mtta_min",
    )
  })

  it("emite BOM UTF-8 y termina cada línea con CRLF", () => {
    const { body, contentType, rows } = buildAlertasReport(data)
    expect(body.startsWith("\uFEFF")).toBe(true)
    expect(body.endsWith("\r\n")).toBe(true)
    expect(body).toContain("\r\n")
    expect(contentType).toBe("text/csv; charset=utf-8")
    expect(rows).toBe(2)
  })

  it("deja vacía la celda de un valor null", () => {
    const [, , row] = lines(buildAlertasReport(data).body)
    const cells = row.split(",")
    expect(cells).toHaveLength(15)
    expect(cells[7]).toBe("") // turno
    expect(cells[12]).toBe("") // acked_at
    expect(cells[13]).toBe("") // acked_por
    expect(cells[14]).toBe("") // mtta_min
  })

  it("neutraliza fórmulas de inyección en strings", () => {
    const { body } = buildAlertasReport(data)
    const [, row] = lines(body)
    expect(row.split(",")).toContain("'=SUM(A1)")
  })

  it("con delimiter ';' usa fechas ART y coma decimal", () => {
    const { body } = buildAlertasReport(data, { delimiter: ";" })
    const [header, row] = lines(body)
    expect(header).toContain(";")
    const cells = row.split(";")
    expect(cells).toHaveLength(15)
    expect(cells[1]).toBe("02/01/2026 00:04")
    expect(cells[12]).toBe("02/01/2026 01:04")
    expect(cells[14]).toBe("10,5")
  })

  it("genera JSON con metadatos, filtros y truncada", () => {
    const { body, contentType, filename, rows } = buildAlertasReport(data, {
      format: "json",
    })
    const json = JSON.parse(body)
    expect(contentType).toBe("application/json; charset=utf-8")
    expect(filename).toBe("reporte-alertas-2026-01-01_a_2026-01-31.json")
    expect(rows).toBe(2)
    expect(typeof json.generated_at).toBe("string")
    expect(json.total).toBe(2)
    expect(json.truncada).toBe(true)
    expect(json.filtros).toEqual({
      desde: "2026-01-01",
      hasta: "2026-01-31",
      sector_id: "s-1",
      producto_id: "p-1",
      turno: "tarde",
      estado: "ACK",
    })
    expect(json.alertas).toEqual(data.alertas)
  })

  it("arma el filename con el rango de fechas", () => {
    expect(buildAlertasReport(data).filename).toBe(
      "reporte-alertas-2026-01-01_a_2026-01-31.csv",
    )
    expect(buildAlertasReport({ total: 0, truncada: false, alertas: [] }).filename).toBe(
      "reporte-alertas-inicio_a_hoy.csv",
    )
  })
})
