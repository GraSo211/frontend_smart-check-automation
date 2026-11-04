import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.stubGlobal("fetch", fetchMock)

import { getReporteOEE } from "@/actions/api"
import { ApiError } from "@/lib/api-client"

const resumen = {
    sector_id: "s1",
    sector_nombre: "Sector 1",
    calculable: true,
    motivos: [],
    availability_pct: 87.5,
    performance_pct: 85.7,
    quality_pct: 95,
    oee_pct: 71.2,
    planned_time_min: 480,
    planned_downtime_min: 0,
    unplanned_downtime_min: 60,
    operating_time_min: 420,
    kg_plan: 1000,
    kg_producidos: 600,
    kg_ok: 570,
    capacidad_teorica_kg: 700,
    energy: { kwh: 300, gas_m3: null, kwh_por_kg_ok: 0.526, gas_m3_por_kg_ok: null },
}

const payload = {
    success: true,
    message: "OEE del período",
    data: {
        periodo: { desde: "2026-11-01", hasta: "2026-11-04", timezone: "America/Argentina/Buenos_Aires" },
        filtros: { sector_id: null },
        global: { ...resumen, sector_id: "", sector_nombre: "Todos" },
        por_sector: [resumen],
    },
}

describe("getReporteOEE", () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_API_URL = "https://backend.example"
        fetchMock.mockReset()
        cookiesMock.mockResolvedValue({ get: () => ({ value: "session-token" }) })
    })

    it("arma la query y devuelve el OEE del período", async () => {
        fetchMock.mockResolvedValue(Response.json(payload))

        const result = await getReporteOEE({
            desde: "2026-11-01",
            hasta: "2026-11-04",
            sectorId: "s1",
        })

        expect(fetchMock).toHaveBeenCalledWith(
            "https://backend.example/api/v1/reportes/oee?desde=2026-11-01&hasta=2026-11-04&sector_id=s1",
            expect.objectContaining({ cache: "no-store" }),
        )
        expect(result.global.oee_pct).toBe(71.2)
        expect(result.por_sector).toHaveLength(1)
    })

    it("traduce un 400 a ApiError", async () => {
        fetchMock.mockResolvedValue(
            Response.json({ success: false, message: "filtros inválidos" }, { status: 400 }),
        )

        await expect(getReporteOEE({ desde: "mal" })).rejects.toBeInstanceOf(ApiError)
        await expect(getReporteOEE({ desde: "mal" })).rejects.toMatchObject({ status: 400 })
    })

    it("rechaza un envelope inválido", async () => {
        fetchMock.mockResolvedValue(
            Response.json({ success: true, data: { global: {}, por_sector: "nope" } }),
        )

        await expect(getReporteOEE()).rejects.toThrow("OEE inválido")
    })

    it("acepta respuestas sin energy", async () => {
        const sinEnergy = { ...resumen } as Record<string, unknown>
        delete sinEnergy.energy
        fetchMock.mockResolvedValue(
            Response.json({ ...payload, data: { ...payload.data, global: sinEnergy } }),
        )

        const result = await getReporteOEE()
        expect(result.global.energy).toBeUndefined()
    })
})
