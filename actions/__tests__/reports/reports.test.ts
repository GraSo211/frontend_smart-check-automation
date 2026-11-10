import { describe, expect, it } from "vitest"

import type { ReporteLote } from "@/lib/reportes-types"
import { buildLotesReport } from "@/actions/reports"

function lote(overrides: Partial<ReporteLote> = {}): ReporteLote {
    return {
        id: "l-1",
        sector_id: "s-1",
        sector_nombre: "Horno 1",
        producto_id: "p-1",
        producto_nombre: "Tostada",
        turno: "mañana",
        estado: "CERRADO",
        abierto_en: "2026-01-15T13:00:00.000Z",
        cerrado_en: "2026-01-15T14:00:00.000Z",
        motivo_cierre: "manual",
        modo: "AUTOMATICO",
        conteos: { ok: 90, crudo: 6, quemado: 4, total: 100 },
        kg: { ok: 22.5, crudo: 1.5, quemado: 1, total: 25, merma: 2.5 },
        confianza_promedio: 0.873,
        duracion_min: 60,
        fpy_pct: 90.5,
        crudo_pct: 6,
        quemado_pct: 4,
        ...overrides,
    }
}

function csvLines(body: string): string[] {
    return body.replace(/^\uFEFF/, "").split("\r\n")
}

describe("buildLotesReport (CSV)", () => {
    it("incluye BOM UTF-8, CRLF y las columnas productivas y económicas", () => {
        const report = buildLotesReport([lote()], { format: "csv" })
        expect(report.body.charCodeAt(0)).toBe(0xfeff)
        expect(report.body).toContain("\r\n")
        expect(report.contentType).toContain("text/csv")
        expect(report.rows).toBe(1)
        const header = csvLines(report.body)[0]!.split(",")
        expect(header).toEqual([
            "id", "sector_id", "sector_nombre", "producto_id", "producto_nombre",
            "turno", "estado", "abierto_en", "cerrado_en", "motivo_cierre", "modo",
            "total", "ok", "crudo", "quemado", "kg_ok", "kg_crudo", "kg_quemado",
            "kg_total", "kg_merma", "confianza_promedio", "duracion_min", "fpy_pct",
            "crudo_pct", "quemado_pct",
            "costo_fabricacion_unitario_ars", "perdida_merma_ars", "referencia_costo_merma",
        ])
    })

    it("deja vacíos los campos null", () => {
        const report = buildLotesReport(
            [lote({
                cerrado_en: null,
                motivo_cierre: null,
                turno: null,
                modo: null,
                kg: { ok: null, crudo: null, quemado: null, total: null, merma: null },
                confianza_promedio: null,
                duracion_min: null,
                fpy_pct: null,
                crudo_pct: null,
                quemado_pct: null,
            })],
            { format: "csv" },
        )
        const row = csvLines(report.body)[1]!.split(",")
        expect(row[5]).toBe("")
        expect(row[8]).toBe("")
        expect(row[9]).toBe("")
        expect(row[10]).toBe("")
        expect(row.slice(15, 27)).toEqual(Array(12).fill(""))
        expect(row[27]).toBe("actual_producto")
    })

    it("escapa comas y comillas según RFC 4180", () => {
        const report = buildLotesReport(
            [lote({ producto_nombre: 'Pan, "artesanal"' })],
            { format: "csv" },
        )
        expect(report.body).toContain('"Pan, ""artesanal"""')
    })

    it("neutraliza fórmulas CSV sólo en strings", () => {
        const report = buildLotesReport(
            [lote({ producto_nombre: "=SUM(A1)", sector_nombre: "@hola", id: "-lote" })],
            { format: "csv" },
        )
        const row = csvLines(report.body)[1]!.split(",")
        expect(row[0]).toBe("'-lote")
        expect(row[2]).toBe("'@hola")
        expect(row[4]).toBe("'=SUM(A1)")
        // Los números negativos no se prefijan.
        expect(csvLines(
            buildLotesReport([lote({ duracion_min: -3 })], { format: "csv" }).body,
        )[1]!.split(",")[21]).toBe("-3")
    })

    it("con delim=; usa coma decimal y fechas dd/mm/aaaa hh:mm ART", () => {
        const report = buildLotesReport([lote()], { format: "csv", delimiter: ";" })
        const row = csvLines(report.body)[1]!.split(";")
        expect(row[7]).toBe("15/01/2026 10:00")
        expect(row[8]).toBe("15/01/2026 11:00")
        expect(row[21]).toBe("60")
        expect(row[22]).toBe("90,5")
        expect(row[15]).toBe("22,5")
        expect(report.body).not.toContain('""')
    })

    it("genera filename con el rango y los filtros sanitizados", () => {
        expect(
            buildLotesReport([], { format: "csv", desde: "2026-10-01", hasta: "2026-10-31" }).filename,
        ).toBe("reporte-lotes-2026-10-01_a_2026-10-31.csv")
        expect(
            buildLotesReport([], {
                format: "json",
                desde: "2026-10-01",
                hasta: "2026-10-31",
                sectorId: "Horno 1",
                productoId: "p/1",
            }).filename,
        ).toBe("reporte-lotes-2026-10-01_a_2026-10-31-horno-1-p-1.json")
    })
})

describe("buildLotesReport (JSON)", () => {
    it("incluye metadatos, filtros y los lotes crudos", () => {
        const report = buildLotesReport([lote()], {
            format: "json",
            desde: "2026-10-01",
            hasta: "2026-10-31",
            sectorId: "s-1",
        })
        expect(report.contentType).toContain("application/json")
        expect(report.rows).toBe(1)
        const parsed = JSON.parse(report.body)
        expect(parsed.total).toBe(1)
        expect(parsed.generated_at).toBeTruthy()
        expect(parsed.filtros).toEqual({
            desde: "2026-10-01",
            hasta: "2026-10-31",
            sector_id: "s-1",
            producto_id: null,
            turno: null,
        })
        expect(parsed.lotes).toEqual([lote()])
    })
})
