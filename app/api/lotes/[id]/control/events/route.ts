import { proxyMonitoringEvents } from "@/lib/monitoring-server"

export const dynamic = "force-dynamic"

// GET /api/lotes/[id]/control/events → reenvía la suscripción SSE al
// endpoint del backend `/api/v1/lotes/{id}/control/events`. El backend
// filtra los eventos `control.propuesta` por el {id} del path.
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params
    if (!id) {
        return new Response("Lote no especificado", { status: 400 })
    }
    return proxyMonitoringEvents(request, `/api/v1/lotes/${encodeURIComponent(id)}/control/events`)
}