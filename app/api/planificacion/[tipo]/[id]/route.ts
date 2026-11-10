import { cookies } from "next/headers"

import { getBackendUrl } from "@/lib/api-client"
import { isTipoImportacion } from "@/lib/planificacion"
import { isLoteUUID } from "@/lib/reportes"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const DELETE_TIMEOUT_MS = 20_000

function errorResponse(message: string, status: number): Response {
    return Response.json(
        { success: false, message },
        { status, headers: { "cache-control": "private, no-store" } },
    )
}

// DELETE /api/planificacion/[tipo]/[id]
//
// Borra un ítem de plan/paradas. Propaga 200/400/404/500 del backend;
// un fallo de red se traduce a 502.
export async function DELETE(
    _request: Request,
    context: { params: Promise<{ tipo: string; id: string }> },
) {
    const { tipo, id } = await context.params
    if (!isTipoImportacion(tipo)) {
        return errorResponse("Tipo de planificación inválido. Usá plan o paradas.", 400)
    }
    if (!isLoteUUID(id)) {
        return errorResponse("El id debe ser un UUID válido.", 400)
    }

    const token = (await cookies()).get("session_token")?.value

    let upstream: Response
    try {
        upstream = await fetch(
            `${getBackendUrl()}/api/v1/planificacion/${tipo}/${encodeURIComponent(id)}`,
            {
                method: "DELETE",
                headers: token ? { Cookie: `session_token=${token}` } : {},
                cache: "no-store",
                signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
            },
        )
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
