import { describe, expect, it } from "vitest"
import { parseBackendPage, parseCompleteCollection } from "@/lib/pagination"

describe("paginación de colecciones backend", () => {
  it("sólo acepta el fixture legacy cuando termina en una página corta", async () => {
    const legacy = parseBackendPage<{ id: string }>({ success: true, data: [{ id: "a" }] }, {
      requestedPage: 1,
      requestedPageSize: 100,
      allowLegacyMetadata: true,
    })
    expect(legacy?.hasMetadata).toBe(false)
  })

  it("valida una colección completa sin aplicar el límite de 100 por página", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({ id: `run-${index}` }))
    expect(parseCompleteCollection({
      success: true, data: rows, total: 101, page: 1, pageSize: 100,
    }, (item: { id: string }) => item.id)?.items).toHaveLength(101)
    expect(parseCompleteCollection({
      success: true, data: rows.slice(0, 100), total: 100, page: 1, pageSize: 100,
    }, (item: { id: string }) => item.id)?.items).toHaveLength(100)
    expect(parseCompleteCollection({
      success: true, data: rows.slice(0, 100), page: 1, pageSize: 100,
    }, (item: { id: string }) => item.id)).toBeNull()
  })
})
