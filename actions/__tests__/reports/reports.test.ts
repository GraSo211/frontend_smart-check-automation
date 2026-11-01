import { describe, expect, it } from "vitest"

import type { LoteSector } from "@/lib/production-data"
import { buildLotesReport, filterLotesForReport } from "@/actions/reports"

function lote(overrides: Partial<LoteSector> = {}): LoteSector {
    return {
        id: "l-1",
        sector_id: "s-1",
        estado: "CERRADO",
        producto_id: "p-1",
        producto_nombre: "Tostada",
        abierto_en: "2026-01-15T10:00:00.000Z",
        abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
        conteos: { ok: 80, crudo: 5, quemado: 15, total: 100 },
        ultimo_evento_en: "2026-01-15T11:00:00.000Z",
        inactividad_segundos: 5,
        cerrado_en: "2026-01-15T11:30:00.000Z",
        motivo_cierre: "FIN",
        modo: "AUTOMATICO",
        temp1_objetivo: 200,
        vel_objetivo: 1.0,
        ...overrides,
    }
}

describe("filterLotesForReport", () => {
    const runs: LoteSector[] = [
        lote({ id: "l-1", abierto_en: "2026-01-15T10:00:00.000Z" }),
        lote({ id: "l-2", abierto_en: "2026-01-20T10:00:00.000Z" }),
        lote({ id: "l-3", abierto_en: "2026-01-25T10:00:00.000Z" }),
    ]

    it("filtra por loteId con precedencia absoluta", () => {
        const filtered = filterLotesForReport(runs, { loteId: "l-2" })
        expect(filtered.map((r) => r.id)).toEqual(["l-2"])
    })

    it("filtra por rango de fechas con `desde` y `hasta`", () => {
        const filtered = filterLotesForReport(runs, {
            desde: "2026-01-18T00:00:00.000Z",
            hasta: "2026-01-22T00:00:00.000Z",
        })
        expect(filtered.map((r) => r.id)).toEqual(["l-2"])
    })

    it("incluye los bordes del rango", () => {
        const filtered = filterLotesForReport(runs, {
            desde: "2026-01-15T10:00:00.000Z",
            hasta: "2026-01-25T10:00:00.000Z",
        })
        expect(filtered).toHaveLength(3)
    })

    it("omite lotes con abierto_en inválida", () => {
        const filtered = filterLotesForReport(
            [lote({ id: "l-mal", abierto_en: "no-es-fecha" })],
            {},
        )
        expect(filtered).toEqual([])
    })

    it("devuelve todos los lotes cuando no hay filtros", () => {
        expect(filterLotesForReport(runs, {})).toHaveLength(3)
    })
})

describe("buildLotesReport (CSV)", () => {
    const runs = [lote({ id: "l-1" }), lote({ id: "l-2", producto_nombre: "Pan, con coma" })]

    it("incluye BOM UTF-8 y separador CRLF", () => {
        const report = buildLotesReport(runs, { format: "csv" })
        expect(report.body.charCodeAt(0)).toBe(0xfeff)
        expect(report.body).toContain("\r\n")
        expect(report.contentType).toContain("text/csv")
        expect(report.rows).toBe(2)
    })

    it("emite la fila de encabezado con todas las columnas", () => {
        const report = buildLotesReport(runs, { format: "csv" })
        const firstLine = report.body.split("\r\n")[0]!.replace(/^\uFEFF/, "")
        expect(firstLine.split(",").length).toBe(19)
        expect(firstLine).toContain("id")
        expect(firstLine).toContain("calidad_pct")
    })

    it("escapa comas y comillas según RFC 4180", () => {
        const report = buildLotesReport(runs, { format: "csv" })
        expect(report.body).toContain('"Pan, con coma"')
    })

    it("genera filename estable basado en loteId o fecha", () => {
        expect(
            buildLotesReport(runs, { format: "csv", loteId: "l-1" }).filename,
        ).toMatch(/^lotes-l-1-\d{4}-\d{2}-\d{2}\.csv$/)
        expect(buildLotesReport(runs, { format: "csv" }).filename).toMatch(
            /^lotes-\d{4}-\d{2}-\d{2}\.csv$/,
        )
    })

    it("deja vacíos los campos null/undefined (no «0» fabricado)", () => {
        const report = buildLotesReport(
            [lote({ vel_objetivo: undefined })],
            { format: "csv" },
        )
        // La columna vel_objetivo queda como string vacío al final de la fila.
        expect(report.body).toContain(",\r\n")
    })
})

describe("buildLotesReport (JSON)", () => {
    const runs = [lote({ id: "l-1" }), lote({ id: "l-2" })]

    it("devuelve JSON con metadatos y array de lotes", () => {
        const report = buildLotesReport(runs, { format: "json" })
        expect(report.contentType).toContain("application/json")
        const parsed = JSON.parse(report.body)
        expect(parsed.total).toBe(2)
        expect(parsed.lotes).toHaveLength(2)
        expect(parsed.lotes[0].id).toBe("l-1")
        expect(parsed.generated_at).toBeTruthy()
    })

    it("incluye la calidad computada cuando ok no es null", () => {
        const report = buildLotesReport([lote({ id: "l-1" })], { format: "json" })
        const parsed = JSON.parse(report.body)
        expect(parsed.lotes[0].calidad_pct).toBe("80.0")
    })

    it("omite la calidad cuando ok es null (no publica 0.0%)", () => {
        const report = buildLotesReport(
            [lote({ id: "l-1", conteos: { ok: null, crudo: 0, quemado: 0, total: 100 } })],
            { format: "json" },
        )
        const parsed = JSON.parse(report.body)
        expect(parsed.lotes[0].calidad_pct).toBeNull()
    })

    it("respeta el filtro por loteId", () => {
        const report = buildLotesReport(runs, { format: "json", loteId: "l-2" })
        const parsed = JSON.parse(report.body)
        expect(parsed.total).toBe(1)
        expect(parsed.lotes[0].id).toBe("l-2")
    })
})