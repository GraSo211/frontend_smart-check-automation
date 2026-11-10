import { describe, expect, it, vi } from "vitest"
import type { LoteSector } from "@/lib/production-data"
import { MAX_LOTE_PAGES_PER_SECTOR, walkLoteSectors } from "@/lib/lotes-cursor-walk"

const lote = (id: string, sectorId: string) => ({ id, sector_id: sectorId }) as LoteSector

describe("walkLoteSectors", () => {
  it("sigue el cursor de cada sector y deduplica por id entre sectores", async () => {
    const fetchPage = vi.fn(async (sectorId: string, cursor: string | undefined) => {
      if (cursor) return { items: [lote("shared", sectorId), lote(`${sectorId}-b`, sectorId)], total: 2, siguienteCursor: null }
      return { items: [lote(`${sectorId}-a`, sectorId), lote("shared", sectorId)], total: 2, siguienteCursor: "next" }
    })

    const result = await walkLoteSectors([{ id: "s-1" }, { id: "s-2" }], fetchPage)

    expect(result.items.map((item) => item.id).sort()).toEqual(["s-1-a", "s-1-b", "s-2-a", "s-2-b", "shared"])
    expect(result.truncada).toBe(false)
    expect(fetchPage).toHaveBeenCalledTimes(4)
    expect(fetchPage).toHaveBeenCalledWith("s-1", "next")
    expect(fetchPage).toHaveBeenCalledWith("s-2", "next")
  })

  it("marca truncada cuando se alcanza el tope de páginas con cursor pendiente", async () => {
    const fetchPage = vi.fn(async (_sectorId: string, cursor: string | undefined) => ({
      items: [lote(`p-${cursor ?? "0"}`, "s-1")],
      total: 1,
      siguienteCursor: "mas",
    }))

    const result = await walkLoteSectors([{ id: "s-1" }], fetchPage)

    expect(result.truncada).toBe(true)
    expect(fetchPage).toHaveBeenCalledTimes(MAX_LOTE_PAGES_PER_SECTOR)
  })

  it("marca truncada cuando se recolectaron menos lotes que el total reportado", async () => {
    const result = await walkLoteSectors([{ id: "s-1" }], async () => ({
      items: [lote("a", "s-1")],
      total: 5,
      siguienteCursor: null,
    }))

    expect(result.truncada).toBe(true)
  })

  it("propaga el error del fetch y no devuelve una colección parcial", async () => {
    const fetchPage = vi.fn(async (sectorId: string) => {
      if (sectorId === "s-2") throw new Error("boom")
      return { items: [lote("a", sectorId)], total: 1, siguienteCursor: null }
    })

    await expect(walkLoteSectors([{ id: "s-1" }, { id: "s-2" }], fetchPage)).rejects.toThrow("boom")
  })
})
