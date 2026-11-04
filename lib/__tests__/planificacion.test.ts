import { describe, expect, it } from "vitest"

import {
    buildCsvTemplate,
    buildImportUrl,
    buildPlanificacionItemUrl,
    buildPlanificacionListaUrl,
    isTipoImportacion,
} from "@/lib/planificacion"

describe("planificacion", () => {
    it("reconoce sólo los tipos propios, no el prototipo", () => {
        expect(isTipoImportacion("plan")).toBe(true)
        expect(isTipoImportacion("paradas")).toBe(true)
        expect(isTipoImportacion("energia")).toBe(true)
        expect(isTipoImportacion("toString")).toBe(false)
        expect(isTipoImportacion("__proto__")).toBe(false)
        expect(isTipoImportacion("PLAN")).toBe(false)
        expect(isTipoImportacion("")).toBe(false)
        expect(isTipoImportacion(null)).toBe(false)
    })

    it("construye la URL interna del proxy", () => {
        expect(buildImportUrl("plan")).toBe("/api/planificacion/plan/import")
        expect(buildImportUrl("paradas")).toBe("/api/planificacion/paradas/import")
        expect(buildImportUrl("energia")).toBe("/api/planificacion/energia/import")
    })

    it("construye la URL interna del listado y del item", () => {
        expect(buildPlanificacionListaUrl("plan")).toBe("/api/planificacion/plan")
        expect(buildPlanificacionListaUrl("energia", {
            desde: "2026-11-01",
            hasta: "2026-11-30",
            sectorId: "horno/1",
            limite: 100,
        })).toBe(
            "/api/planificacion/energia?desde=2026-11-01&hasta=2026-11-30&sector_id=horno%2F1&limite=100",
        )
        expect(buildPlanificacionItemUrl("paradas", "a1b2c3d4-5678-90ab-cdef-1234567890ab")).toBe(
            "/api/planificacion/paradas/a1b2c3d4-5678-90ab-cdef-1234567890ab",
        )
        expect(buildPlanificacionItemUrl("plan", "id/con espacio")).toBe(
            "/api/planificacion/plan/id%2Fcon%20espacio",
        )
    })

    it("devuelve header + una fila de ejemplo por tipo", () => {
        expect(buildCsvTemplate("plan").split("\n")[0]).toBe(
            "sector_id,fecha,turno,producto_id,inicio,fin,kg_plan",
        )
        expect(buildCsvTemplate("paradas").split("\n")[0]).toBe(
            "sector_id,lote_id,causa_codigo,tipo,inicio,fin,notas",
        )
        expect(buildCsvTemplate("energia").split("\n")[0]).toBe(
            "sector_id,lote_id,periodo_inicio,periodo_fin,kwh,gas_m3",
        )
        for (const tipo of ["plan", "paradas", "energia"] as const) {
            const rows = buildCsvTemplate(tipo).trimEnd().split("\n")
            expect(rows).toHaveLength(2)
            expect(rows[1].length).toBeGreaterThan(0)
        }
    })
})
