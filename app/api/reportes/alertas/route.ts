import { NextRequest } from "next/server"

import { getReporteAlertas } from "@/actions/api"
import { ApiError } from "@/lib/api-client"
import { buildAlertasReport } from "@/lib/reportes-alertas-csv"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

function badRequest(message: string): Response {
    return Response.json({ success: false, message }, { status: 400 })
}

function errorResponse(error: unknown): Response {
    if (error instanceof ApiError) {
        return Response.json(
            { success: false, message: error.message },
            { status: error.status },
        )
    }
    return Response.json(
        {
            success: false,
            message: error instanceof Error ? error.message : "Error desconocido",
        },
        { status: 502 },
    )
}

// GET /api/reportes/alertas?format=csv|json&desde&hasta&sector_id&producto_id&turno&estado&delim
//
// Descarga las alertas del período desde GET /api/v1/reportes/alertas.
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams

    const formatParam = (params.get("format") ?? "csv").toLowerCase()
    if (formatParam !== "csv" && formatParam !== "json") {
        return badRequest("Formato no soportado. Usá csv o json.")
    }

    const delimParam = params.get("delim")
    if (delimParam !== null && delimParam !== "," && delimParam !== ";") {
        return badRequest("Delimitador no soportado. Usá , o ;.")
    }

    const filtros = {
        desde: params.get("desde"),
        hasta: params.get("hasta"),
        sectorId: params.get("sector_id"),
        productoId: params.get("producto_id"),
        turno: params.get("turno"),
        estado: params.get("estado"),
    }

    let result
    try {
        result = await getReporteAlertas(filtros, { limite: 5000 })
    } catch (error) {
        return errorResponse(error)
    }

    const report = buildAlertasReport(
        { ...result, filtros },
        {
            format: formatParam,
            delimiter: delimParam ?? undefined,
        },
    )

    return new Response(report.body, {
        status: 200,
        headers: {
            "content-type": report.contentType,
            "content-disposition": `attachment; filename="${report.filename}"`,
            "cache-control": "private, no-store",
            "x-report-rows": String(report.rows),
            "x-report-truncated": String(result.truncada),
        },
    })
}
