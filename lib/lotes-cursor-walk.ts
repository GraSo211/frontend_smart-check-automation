import type { LoteSector } from './production-data'

/** Page size used by every sector walk (the backend's maximum). */
export const LOTE_PAGE_SIZE = 100
/** Hard cap of pages per sector; reaching it with a cursor pending truncates. */
export const MAX_LOTE_PAGES_PER_SECTOR = 20

export type LoteCursorPage = {
  items: LoteSector[]
  /** `total` reported by the backend for the sector, when present. */
  total?: number
  siguienteCursor: string | null
}

/**
 * Walks every sector's lote history in parallel (each sector's cursor loop stays
 * sequential), deduplicating by `id`. `truncada` is true when a sector hit the
 * page cap with data pending or collected fewer lotes than its reported total.
 * A rejected `fetchPage` aborts the whole walk: callers never see a partial set.
 */
export async function walkLoteSectors(
  sectores: ReadonlyArray<{ id: string }>,
  fetchPage: (sectorId: string, cursor: string | undefined) => Promise<LoteCursorPage>,
): Promise<{ items: LoteSector[]; truncada: boolean }> {
  const byId = new Map<string, LoteSector>()

  const sectorTruncated = await Promise.all(sectores.map(async (sector) => {
    const sectorIds = new Set<string>()
    let cursor: string | undefined
    let sectorTotal = 0
    let capped = false
    for (let page = 0; page < MAX_LOTE_PAGES_PER_SECTOR; page += 1) {
      const result = await fetchPage(sector.id, cursor)
      for (const lote of result.items) {
        sectorIds.add(lote.id)
        byId.set(lote.id, lote)
      }
      if (typeof result.total === 'number' && Number.isFinite(result.total)) {
        sectorTotal = result.total
      }
      if (!result.siguienteCursor) break
      cursor = result.siguienteCursor
      // A cursor on the last allowed page means we stopped with data pending.
      if (page === MAX_LOTE_PAGES_PER_SECTOR - 1) capped = true
    }
    return capped || sectorIds.size < sectorTotal
  }))

  return { items: [...byId.values()], truncada: sectorTruncated.some(Boolean) }
}
