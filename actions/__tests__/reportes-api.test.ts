import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/api-client"
import { buildReporteQuery } from "@/lib/reportes-query"
import { buildTrazabilidadDownloadHref, isLoteUUID } from "@/lib/reportes"

const cookiesMock = vi.hoisted(() =>
    vi.fn(async () => ({
        get: vi.fn(() => ({ value: "jwt-token" })),
    })),
)

vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? "OK" : "Error",
    })
}

const lote = (id: string) => ({
    id,
    sector_id: "s-1",
    sector_nombre: "Horno 1",
    producto_id: "p-1",
    producto_nombre: "Tostada",
    turno: "mañana",
    estado: "CERRADO",
    abierto_en: "2026-10-01T13:00:00.000Z",
    cerrado_en: "2026-10-01T14:00:00.000Z",
    motivo_cierre: "manual",
    modo: "AUTOMATICO",
    conteos: { ok: 90, crudo: 6, quemado: 4, total: 100 },
    kg: { ok: 22.5, crudo: 1.5, quemado: 1, total: 25, merma: 2.5 },
    confianza_promedio: 0.8,
    duracion_min: 60,
    fpy_pct: 90,
    crudo_pct: 6,
    quemado_pct: 4,
})

const resumenData = {
    periodo: { desde: "2026-10-01", hasta: "2026-10-31", timezone: "America/Argentina/Buenos_Aires" },
    filtros: { sector_id: null, producto_id: null, turno: null },
    produccion: {
        lotes_total: 0, lotes_cerrados: 0, lotes_abiertos: 0, unidades: 0,
        unidades_ok: 0, unidades_crudas: 0, unidades_quemadas: 0,
        kg_total_estimados: 0, kg_ok_estimados: 0, kg_merma_estimados: 0,
        duracion_media_min: null, duracion_p95_min: null,
        unidades_por_hora: null, kg_por_hora: null,
        por_turno: [], por_sector: [], por_producto: [],
    },
    calidad: {
        fpy_pct: null, crudo_pct: null, quemado_pct: null,
        confianza_promedio: null, lotes_conformes_pct: null, serie_diaria: [],
    },
    proceso: {
        temp_mae_c: null, temp_en_tolerancia_pct: null,
        vel_mae: null, vel_en_tolerancia_pct: null, serie_diaria: [],
    },
    alertas: {
        total: 0, por_severidad: {}, por_tipo: [], ack_pct: null,
        mtta_min: null, serie_diaria: [],
    },
    automatizacion: {
        decisiones_total: 0, mpc_pct: null, operario_pct: null,
        sin_aplicar_pct: null, z_mae: null, top_skip: [], modo_pct: {},
    },
}

describe("reportes del backend", () => {
    let api: typeof import("../api")
    const fetchMock = vi.fn()

    beforeAll(async () => {
        process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test/"
        vi.stubGlobal("fetch", fetchMock)
        api = await import("../api")
    })

    beforeEach(() => {
        fetchMock.mockReset()
    })

    it("buildReporteQuery serializa los filtros a snake_case y omite vacíos", () => {
        expect(buildReporteQuery()).toBe("")
        expect(buildReporteQuery({
            desde: "2026-10-01",
            hasta: "2026-10-31",
            sectorId: "horno/1",
            productoId: "p-1",
            turno: "mañana",
        })).toBe(
            "desde=2026-10-01&hasta=2026-10-31&sector_id=horno%2F1&producto_id=p-1&turno=ma%C3%B1ana",
        )
    })

    it("getReporteResumen valida el envelope y devuelve los agregados", async () => {
        fetchMock.mockResolvedValue(json({ success: true, message: "ok", data: resumenData }))

        await expect(api.getReporteResumen({ desde: "2026-10-01", hasta: "2026-10-31" })).resolves.toEqual(resumenData)
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://backend.example.test/api/v1/reportes/resumen?desde=2026-10-01&hasta=2026-10-31",
        )
    })

    it("getReporteResumen rechaza un envelope inválido", async () => {
        fetchMock.mockResolvedValue(json({ success: true, data: { periodo: {} } }))

        await expect(api.getReporteResumen()).rejects.toThrow(
            "La API devolvió un resumen de reporte inválido.",
        )
    })

    it("getReporteLotes arma la URL con límite y cursor y expone la página", async () => {
        fetchMock.mockResolvedValue(json({
            success: true,
            data: [lote("l-1")],
            total: 4,
            page: 2,
            pageSize: 100,
            siguiente_cursor: "cursor/3",
        }))

        const result = await api.getReporteLotes(
            { desde: "2026-10-01", sectorId: "s-1" },
            { cursor: "cursor/2", limite: 100 },
        )

        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://backend.example.test/api/v1/reportes/lotes?desde=2026-10-01&sector_id=s-1&limite=100&antes_de=cursor%2F2",
        )
        expect(result).toEqual({
            lotes: [lote("l-1")],
            total: 4,
            page: 2,
            pageSize: 100,
            siguienteCursor: "cursor/3",
        })
    })

    it("getReporteLotes rechaza filas sin conteos/kg", async () => {
        fetchMock.mockResolvedValue(json({
            success: true,
            data: [{ id: "l-1" }],
            total: 1,
        }))

        await expect(api.getReporteLotes()).rejects.toThrow(
            "La API devolvió un detalle de reporte inválido.",
        )
    })

    it("getAllReporteLotes recorre el cursor, deduplica por id y no trunca", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            const antesDe = new URL(url).searchParams.get("antes_de")
            if (!antesDe) {
                return json({
                    success: true,
                    data: [lote("l-1"), lote("l-2")],
                    total: 3,
                    page: 1,
                    pageSize: 2,
                    siguiente_cursor: "c-1",
                })
            }
            return json({
                success: true,
                data: [lote("l-1"), lote("l-3")],
                total: 3,
                page: 2,
                pageSize: 2,
            })
        })

        const result = await api.getAllReporteLotes({ desde: "2026-10-01" })

        expect(result.lotes.map((item) => item.id)).toEqual(["l-1", "l-2", "l-3"])
        expect(result.total).toBe(3)
        expect(result.truncada).toBe(false)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("getAllReporteLotes marca truncada cuando se agota maxPages con cursor pendiente", async () => {
        fetchMock.mockResolvedValue(json({
            success: true,
            data: [lote("l-1")],
            total: 10,
            siguiente_cursor: "c-1",
        }))

        const result = await api.getAllReporteLotes({}, { maxPages: 1 })

        expect(result).toEqual({ lotes: [lote("l-1")], total: 10, truncada: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("propaga ApiError 401 desde getReporteLotes", async () => {
        fetchMock.mockResolvedValue(new Response("", { status: 401 }))

        await expect(api.getReporteLotes()).rejects.toBeInstanceOf(ApiError)
        await expect(api.getReporteLotes()).rejects.toMatchObject({ status: 401 })
    })
})

const trazabilidadData = {
    lote: lote("a1b2c3d4-5678-90ab-cdef-1234567890ab"),
    proceso: {
        temp_mae_c: 1.2,
        temp_en_tolerancia_pct: 88.5,
        vel_mae: 0.012,
        vel_en_tolerancia_pct: 91.2,
        serie: [
            {
                ts: "2026-11-04T14:00:00-03:00",
                temp_real: 181.2,
                temp_objetivo: 180,
                vel_real: 0.2,
                vel_objetivo: 0.2,
                muestras: 12,
            },
        ],
    },
    confianza_clases: [],
    decisiones: [],
    consignas: [],
    alertas: [],
    generado_en: "2026-11-04T11:05:00-03:00",
}

describe("trazabilidad de un lote", () => {
    let api: typeof import("../api")
    const fetchMock = vi.fn()

    beforeAll(async () => {
        process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test/"
        vi.stubGlobal("fetch", fetchMock)
        api = await import("../api")
    })

    beforeEach(() => {
        fetchMock.mockReset()
    })

    it("getReporteTrazabilidad pide el lote y devuelve el snapshot", async () => {
        fetchMock.mockResolvedValue(json({ success: true, message: "ok", data: trazabilidadData }))

        const result = await api.getReporteTrazabilidad("a1b2c3d4-5678-90ab-cdef-1234567890ab")

        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://backend.example.test/api/v1/reportes/trazabilidad?lote_id=a1b2c3d4-5678-90ab-cdef-1234567890ab",
        )
        expect(result).toEqual(trazabilidadData)
    })

    it("getReporteTrazabilidad traduce el 404 del backend a ApiError", async () => {
        fetchMock.mockResolvedValue(new Response("", { status: 404, statusText: "Not Found" }))

        const promise = api.getReporteTrazabilidad("a1b2c3d4-5678-90ab-cdef-1234567890ab")

        await expect(promise).rejects.toBeInstanceOf(ApiError)
        await expect(promise).rejects.toMatchObject({ status: 404 })
    })

    it("getReporteTrazabilidad traduce el 400 y rechaza envelopes sin serie", async () => {
        fetchMock.mockResolvedValue(new Response("", { status: 400, statusText: "Bad Request" }))
        await expect(api.getReporteTrazabilidad("nope")).rejects.toMatchObject({ status: 400 })

        fetchMock.mockResolvedValue(json({ success: true, data: { lote: {}, proceso: {} } }))
        await expect(api.getReporteTrazabilidad("a1b2c3d4-5678-90ab-cdef-1234567890ab")).rejects.toThrow(
            "La API devolvió una trazabilidad inválida.",
        )
    })

    it("isLoteUUID acepta sólo UUID y el href arma el PDF", () => {
        expect(isLoteUUID("a1b2c3d4-5678-90ab-cdef-1234567890ab")).toBe(true)
        expect(isLoteUUID("a1b2c3d4-5678-90ab-cdef-1234567890ab".toUpperCase())).toBe(true)
        expect(isLoteUUID("lote-1")).toBe(false)
        expect(isLoteUUID("")).toBe(false)
        expect(buildTrazabilidadDownloadHref("a1b2c3d4-5678-90ab-cdef-1234567890ab")).toBe(
            "/api/reportes/trazabilidad?lote_id=a1b2c3d4-5678-90ab-cdef-1234567890ab&format=pdf",
        )
    })
})
