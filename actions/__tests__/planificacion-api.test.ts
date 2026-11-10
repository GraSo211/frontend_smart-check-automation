import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/api-client"

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

const planItem = {
    id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    sector_id: "s-1",
    sector_nombre: "Horno 1",
    producto_id: "p-1",
    producto_nombre: "Tostada",
    fecha: "2026-11-01",
    turno: "mañana",
    inicio_at: "2026-11-01T06:00:00-03:00",
    fin_at: "2026-11-01T14:00:00-03:00",
    kg_plan: 1000,
}

describe("listado de planificación del backend", () => {
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

    it("arma la URL en snake_case y devuelve total/truncada/items", async () => {
        fetchMock.mockResolvedValue(json({
            success: true,
            message: "ok",
            data: { total: 4, truncada: true, items: [planItem] },
        }))

        const result = await api.getPlanificacionLista("plan", {
            desde: "2026-11-01",
            hasta: "2026-11-30",
            sectorId: "s-1",
            limite: 50,
        })

        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://backend.example.test/api/v1/planificacion/plan?desde=2026-11-01&hasta=2026-11-30&sector_id=s-1&limite=50",
        )
        expect(result).toEqual({ total: 4, truncada: true, items: [planItem] })
    })

    it("traduce el 400 a ApiError", async () => {
        fetchMock.mockResolvedValue(new Response("", { status: 400, statusText: "Bad Request" }))

        const promise = api.getPlanificacionLista("paradas", { desde: "no-es-fecha" })

        await expect(promise).rejects.toBeInstanceOf(ApiError)
        await expect(promise).rejects.toMatchObject({ status: 400 })
    })

    it("rechaza envelopes e items inválidos", async () => {
        fetchMock.mockResolvedValue(json({ success: false, message: "nope" }))
        await expect(api.getPlanificacionLista("paradas")).rejects.toThrow(
            "La API devolvió una lista de planificación inválida.",
        )

        fetchMock.mockResolvedValue(json({
            success: true,
            data: { total: 1, truncada: false, items: [{ id: "x" }] },
        }))
        await expect(api.getPlanificacionLista("paradas")).rejects.toThrow(
            "La API devolvió una lista de planificación inválida.",
        )
    })
})
