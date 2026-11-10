// @vitest-environment jsdom
import React from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EconomicImpactLive } from "@/components/economic-impact-live"
import type { ReporteEconomico } from "@/lib/reportes-types"

const data: ReporteEconomico = {
  periodo: { desde: "2026-11-01", hasta: "2026-11-10", timezone: "America/Argentina/Buenos_Aires" },
  filtros: { sector_id: null, producto_id: null, turno: null },
  impacto_economico: { moneda: "ARS", referencia_costo: "actual_producto", perdida_ars: 1255, perdida_valorizada_ars: 1255, unidades_merma: 10, unidades_sin_costo: 0, lotes_sin_conteos: 0, por_producto: [] },
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe("refresco del KPI consolidado", () => {
  it("consulta al backend al recibir producción y conserva el importe si falla la siguiente consulta", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(data)))
    vi.stubGlobal("fetch", fetchMock)
    const view = render(<EconomicImpactLive refreshKey="evento-1" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(screen.getByText(/1\.255,00/)).toBeTruthy()
    fetchMock.mockRejectedValueOnce(new Error("Sin conexión"))
    view.rerender(<EconomicImpactLive refreshKey="evento-2" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(screen.getByText(/1\.255,00/)).toBeTruthy()
    expect(screen.getByText(/última consulta confirmada/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store")
  })

  it("refresca cada 30 segundos y rechaza una respuesta malformada", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(data)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ periodo: null, impacto_economico: {} })))
    vi.stubGlobal("fetch", fetchMock)
    render(<EconomicImpactLive initial={data} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/última consulta confirmada/)).toBeTruthy()
    expect(screen.getByText(/1\.255,00/)).toBeTruthy()
  })
})
