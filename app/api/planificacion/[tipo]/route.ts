import { cookies } from "next/headers"

import { getBackendUrl } from "@/lib/api-client"
import { isTipoImportacion } from "@/lib/planificacion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const LISTA_TIMEOUT_MS = 20_000

function errorResponse(message: string, status: number): Response {
    return Response.json(
        { success: false, message },
        { status, headers: { "cache-control": "private, no-store" } },
    )
}

// GET /api/planificacion/[tipo]?desde&hasta&sector_id&limite
//
// Reenvía la query string sin reinterpretarla al backend y propaga su
// status/body/content-type. La cookie session_token viaja como header Cookie.
export async function GET(
    request: Request,
    context: { params: Promise<{ tipo: string }> },
) {
    const { tipo } = await context.params
    if (!isTipoImportacion(tipo)) {
        return errorResponse("Tipo de planificación inválido. Usá plan o paradas.", 400)
    }

    const token = (await cookies()).get("session_token")?.value
    const query = new URL(request.url).search

    let upstream: Response
    try {
        upstream = await fetch(`${getBackendUrl()}/api/v1/planificacion/${tipo}${query}`, {
            headers: token ? { Cookie: `session_token=${token}` } : {},
            cache: "no-store",
            signal: AbortSignal.timeout(LISTA_TIMEOUT_MS),
        })
    } catch {
        return errorResponse("No se pudo contactar al backend.", 502)
    }

    const body = await upstream.text().catch(() => "")
    return new Response(body, {
        status: upstream.status,
        headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "cache-control": "private, no-store",
        },
    })
}
