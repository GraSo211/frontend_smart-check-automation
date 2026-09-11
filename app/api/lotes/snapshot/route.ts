import { proxyMonitoringJson } from '@/lib/monitoring-server'
import { collectPaginatedPages, parseBackendPage, type BackendPage } from '@/lib/pagination'
import { parseProductionPayload } from '@/lib/monitoring-runtime'
import type { ProductionRun } from '@/lib/production-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const pageSize = 100
  let failedResponse: Response | null = null

  try {
    const collection = await collectPaginatedPages<ProductionRun>({
      pageSize,
      getId: (run) => run.id,
      fetchPage: async (page): Promise<BackendPage<ProductionRun>> => {
        const response = await proxyMonitoringJson(request, `/api/v1/lotes-productivos?page=${page}&pageSize=${pageSize}`, true)
        if (!response.ok) {
          failedResponse = response
          throw new Error(`La API respondió con ${response.status}.`)
        }
        const payload: unknown = await response.json().catch(() => null)
        const pageResult = parseBackendPage<ProductionRun>(payload, {
          requestedPage: page,
          requestedPageSize: pageSize,
          allowLegacyMetadata: true,
        })
        if (!pageResult) throw new Error('La API devolvió metadatos de producción inválidos.')
        const items = parseProductionPayload(pageResult.items)
        if (!items) throw new Error('La API devolvió una respuesta inválida para producción.')
        return { ...pageResult, items }
      },
    })

    // Only this all-pages response is published. An upstream page error is
    // returned above, never alongside an apparently complete partial array.
    return Response.json(
      { success: true, data: collection.items, total: collection.total, page: 1, pageSize },
      { headers: { 'cache-control': 'private, no-store' } },
    )
  } catch (error) {
    if (failedResponse) return failedResponse
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'No se pudo completar el snapshot.' },
      { status: 502, headers: { 'cache-control': 'private, no-store' } },
    )
  }
}
