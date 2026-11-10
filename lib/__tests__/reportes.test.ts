import { describe, expect, it } from "vitest"

import {
  buildDownloadHref,
  buildReportesQuery,
  formatPercent,
  getDefaultReporteDateRange,
  parseReporteSearchParams,
} from "@/lib/reportes"

describe("reportes helpers", () => {
  it("default range covers 30 inclusive days", () => {
    const { desde, hasta } = getDefaultReporteDateRange()
    const desdeDate = new Date(`${desde}T00:00:00-03:00`)
    const hastaDate = new Date(`${hasta}T00:00:00-03:00`)
    const diffDays =
      (hastaDate.getTime() - desdeDate.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(29)
  })

  it("uses defaults for missing or invalid dates", () => {
    const defaults = getDefaultReporteDateRange()
    expect(parseReporteSearchParams({})).toMatchObject({
      desde: defaults.desde,
      hasta: defaults.hasta,
      sectorId: "",
      productoId: "",
      turno: "",
    })
    expect(parseReporteSearchParams({ desde: "not-a-date" })).toMatchObject({
      desde: defaults.desde,
      hasta: defaults.hasta,
    })
    expect(parseReporteSearchParams({ hasta: "2026-02-30" })).toMatchObject({
      desde: defaults.desde,
      hasta: defaults.hasta,
    })
  })

  it("preserves valid query params", () => {
    const productoId = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    const parsed = parseReporteSearchParams({
      desde: "2026-01-01",
      hasta: "2026-01-15",
      sector_id: "s-1",
      producto_id: productoId,
      turno: "mañana",
    })
    expect(parsed).toEqual({
      desde: "2026-01-01",
      hasta: "2026-01-15",
      sectorId: "s-1",
      productoId,
      turno: "mañana",
    })
  })

  it("descarta producto, turno y rangos inválidos", () => {
    const defaults = getDefaultReporteDateRange()
    const parsed = parseReporteSearchParams({
      desde: "2026-01-01",
      hasta: "2026-01-15",
      producto_id: "no-es-uuid",
      turno: "madrugada",
    })
    expect(parsed.productoId).toBe("")
    expect(parsed.turno).toBe("")
    expect(parsed.desde).toBe("2026-01-01")

    const inverted = parseReporteSearchParams({
      desde: "2026-02-01",
      hasta: "2026-01-01",
    })
    expect(inverted).toMatchObject({
      desde: defaults.desde,
      hasta: defaults.hasta,
    })
  })

  it("builds navigation query omitting empty filters", () => {
    const query = buildReportesQuery({
      desde: "2026-01-01",
      hasta: "2026-01-15",
      sectorId: "s-1",
      productoId: "",
      turno: "tarde",
    })
    expect(query).toBe(
      "desde=2026-01-01&hasta=2026-01-15&sector_id=s-1&turno=tarde",
    )
  })

  it("builds download hrefs with applied filters", () => {
    const filters = {
      desde: "2026-01-01",
      hasta: "2026-01-15",
      sectorId: "s-1",
      productoId: "p-1",
      turno: "",
    }
    expect(buildDownloadHref(filters, "csv", ",")).toBe(
      "/api/reportes/lotes?desde=2026-01-01&hasta=2026-01-15&sector_id=s-1&producto_id=p-1&format=csv&delim=%2C",
    )
    expect(buildDownloadHref(filters, "csv", ";")).toContain("delim=%3B")
    expect(buildDownloadHref(filters, "json")).toBe(
      "/api/reportes/lotes?desde=2026-01-01&hasta=2026-01-15&sector_id=s-1&producto_id=p-1&format=json",
    )
    expect(buildDownloadHref(filters, "pdf")).toBe(
      "/api/reportes/lotes?desde=2026-01-01&hasta=2026-01-15&sector_id=s-1&producto_id=p-1&format=pdf",
    )
    expect(buildDownloadHref(filters, "pdf", ";")).not.toContain("delim=")
  })

  it("formats null as em dash", () => {
    expect(formatPercent(null)).toBe("—")
  })
})
