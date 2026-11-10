import { proxyMonitoringJson } from '@/lib/monitoring-server'
import { parseLoteSectorPayload } from '@/lib/monitoring-runtime'
import { isRecord } from '@/lib/is-record'
import { LOTE_PAGE_SIZE, walkLoteSectors } from '@/lib/lotes-cursor-walk'

export const dynamic = 'force-dynamic'

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

type SnapshotPageFailure =
  | { failure: Response }
  | { invalid: true }

// Thrown by the page fetcher so the walk stays generic while this route keeps
// its "return the upstream error / 502 on invalid" contract.
class SnapshotPageError extends Error {
  constructor(readonly page: SnapshotPageFailure) {
    super('snapshot page failure')
  }
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

  let walked: Awaited<ReturnType<typeof walkLoteSectors>>
  try {
    walked = await walkLoteSectors(sectores, async (sectorId, cursor) => {
      const params = new URLSearchParams({ sector_id: sectorId, limite: String(LOTE_PAGE_SIZE) })
      if (cursor) params.set('antes_de', cursor)
      const response = await proxyMonitoringJson(request, `/api/v1/lotes?${params.toString()}`, true)
      if (!response.ok) throw new SnapshotPageError({ failure: response })

      const payload: unknown = await response.json().catch(() => null)
      const items = parseLoteSectorPayload(payload)
      if (items === null) throw new SnapshotPageError({ invalid: true })
      return {
        items,
        total: isRecord(payload) && typeof payload.total === 'number' && Number.isFinite(payload.total)
          ? payload.total
          : undefined,
        siguienteCursor: readCursor(payload),
      }
    })
  } catch (e) {
    if (!(e instanceof SnapshotPageError)) throw e
    if ('failure' in e.page) return e.page.failure
    return invalidResponse('La API devolvió una respuesta inválida para el historial de lotes.')
  }

  if (walked.truncada) {
    console.warn('[lotes/snapshot] Snapshot truncado: se alcanzó el tope de páginas o faltan lotes respecto del total reportado por el sector.')
  }
  return Response.json(
    { success: true, data: walked.items, total: walked.items.length, page: 1, pageSize: LOTE_PAGE_SIZE, truncada: walked.truncada },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
