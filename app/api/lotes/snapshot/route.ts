import { proxyMonitoringJson } from '@/lib/monitoring-server'
import { parseLoteSectorPayload } from '@/lib/monitoring-runtime'
import type { LoteSector } from '@/lib/production-data'
import { isRecord } from '@/lib/is-record'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 100
const MAX_PAGES_PER_SECTOR = 20

function invalidResponse(message: string): Response {
  return Response.json(
    { success: false, message },
    { status: 502, headers: { 'cache-control': 'private, no-store' } },
  )
}

function readSectores(payload: unknown): Array<{ id: string; nombre: string }> | null {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) return null
  const sectores: Array<{ id: string; nombre: string }> = []
  for (const item of payload.data) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' ||
      typeof item.nombre !== 'string' || item.nombre === '') {
      return null
    }
    sectores.push({ id: item.id, nombre: item.nombre })
  }
  return sectores
}

function readCursor(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  const cursor = payload.siguiente_cursor
  return typeof cursor === 'string' && cursor !== '' ? cursor : null
}

// Global snapshot: the provider is global, so the route collects every sector's
// lote history and publishes a single deduplicated collection. Sectors are
// walked in parallel; each sector's own cursor loop stays sequential. A failed
// upstream page is returned unchanged; a partial array is never published.
export async function GET(request: Request) {
  const sectoresResponse = await proxyMonitoringJson(request, '/api/v1/sectores', true)
  if (!sectoresResponse.ok) return sectoresResponse

  const sectoresPayload: unknown = await sectoresResponse.json().catch(() => null)
  const sectores = readSectores(sectoresPayload)
  if (!sectores) return invalidResponse('La API devolvió sectores inválidos.')

  const byId = new Map<string, LoteSector>()
  let truncada = false

  type SectorResult =
    | { failure: Response }
    | { invalid: true }
    | { truncated: boolean }

  const results = await Promise.all(sectores.map(async (sector): Promise<SectorResult> => {
    const sectorIds = new Set<string>()
    let cursor: string | undefined
    let sectorTotal = 0
    let capped = false
    for (let page = 0; page < MAX_PAGES_PER_SECTOR; page += 1) {
      const params = new URLSearchParams({ sector_id: sector.id, limite: String(PAGE_SIZE) })
      if (cursor) params.set('antes_de', cursor)
      const response = await proxyMonitoringJson(request, `/api/v1/lotes?${params.toString()}`, true)
      if (!response.ok) return { failure: response }

      const payload: unknown = await response.json().catch(() => null)
      const rows = parseLoteSectorPayload(payload)
      if (rows === null) return { invalid: true }
      for (const lote of rows) {
        sectorIds.add(lote.id)
        byId.set(lote.id, lote)
      }
      if (isRecord(payload) && typeof payload.total === 'number' && Number.isFinite(payload.total)) {
        sectorTotal = payload.total
      }

      const next = readCursor(payload)
      if (!next) {
        cursor = undefined
        break
      }
      cursor = next
      // A cursor on the last allowed page means we stopped with data pending.
      if (page === MAX_PAGES_PER_SECTOR - 1) capped = true
    }
    return { truncated: capped || sectorIds.size < sectorTotal }
  }))

  for (const result of results) {
    if ('failure' in result) return result.failure
    if ('invalid' in result) return invalidResponse('La API devolvió una respuesta inválida para el historial de lotes.')
    if (result.truncated) truncada = true
  }

  const merged = [...byId.values()]
  if (truncada) {
    console.warn('[lotes/snapshot] Snapshot truncado: se alcanzó el tope de páginas o faltan lotes respecto del total reportado por el sector.')
  }
  return Response.json(
    { success: true, data: merged, total: merged.length, page: 1, pageSize: PAGE_SIZE, truncada },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
