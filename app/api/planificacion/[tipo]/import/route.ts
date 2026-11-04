import { cookies } from "next/headers"

import { getBackendUrl } from "@/lib/api-client"
import { isTipoImportacion } from "@/lib/planificacion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const IMPORTS_TIMEOUT_MS = 55_000

function errorResponse(message: string, status: number): Response {
    return Response.json(
        { success: false, message },
        { status, headers: { "cache-control": "private, no-store" } },
    )
}

// POST /api/planificacion/[tipo]/import
//
// Reenvía el multipart al backend sin tocar el body: el boundary lo genera
// fetch al serializar el FormData. La cookie session_token viaja como header
// Cookie y el backend decide 400/401/403.
export async function POST(
    request: Request,
    context: { params: Promise<{ tipo: string }> },
) {
    const { tipo } = await context.params
    if (!isTipoImportacion(tipo)) {
        return errorResponse("Tipo de importación inválido. Usá plan, paradas o energia.", 400)
    }

    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return errorResponse("El cuerpo debe ser multipart/form-data con un archivo CSV.", 400)
    }
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
        return errorResponse("Falta el archivo CSV en el campo file.", 400)
    }

    const token = (await cookies()).get("session_token")?.value

    let upstream: Response
    try {
        upstream = await fetch(`${getBackendUrl()}/api/v1/planificacion/${tipo}/import`, {
            method: "POST",
            headers: token ? { Cookie: `session_token=${token}` } : {},
            body: form,
            cache: "no-store",
            signal: AbortSignal.timeout(IMPORTS_TIMEOUT_MS),
        })
    } catch {
        return errorResponse("No se pudo contactar al backend.", 502)
    }

    // Se propaga el body tal cual (éxito y errores del backend vienen en JSON).
    const body = await upstream.text().catch(() => "")
    return new Response(body, {
        status: upstream.status,
        headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "cache-control": "private, no-store",
        },
    })
}
