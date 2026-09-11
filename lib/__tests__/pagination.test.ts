import { describe, expect, it } from "vitest"
import { collectPaginatedPages, parseBackendPage, parseCompleteCollection } from "@/lib/pagination"

describe("paginación de colecciones backend", () => {
  it("rechaza un total que cambia o una página sin progreso", async () => {
    let page = 0
    await expect(collectPaginatedPages({
      pageSize: 100,
      getId: (item: { id: string }) => item.id,
      fetchPage: async () => {
        page += 1
        return {
          items: [{ id: "same" }],
          total: page === 1 ? 101 : 102,
          page,
          pageSize: 100,
          hasMetadata: true,
        }
      },
    })).rejects.toThrow("total cambió")
  })

  it("sólo acepta el fixture legacy cuando termina en una página corta", async () => {
    const legacy = parseBackendPage<{ id: string }>({ success: true, data: [{ id: "a" }] }, {
      requestedPage: 1,
      requestedPageSize: 100,
      allowLegacyMetadata: true,
    })
    expect(legacy?.hasMetadata).toBe(false)

    await expect(collectPaginatedPages({
      pageSize: 100,
      getId: (item: { id: string }) => item.id,
      fetchPage: async (page) => ({
        items: page === 1 ? Array.from({ length: 100 }, (_, index) => ({ id: `${index}` })) : [],
        page,
        pageSize: 100,
        hasMetadata: false,
      }),
    })).resolves.toMatchObject({ total: 100 })
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
