import { NextRequest } from "next/server"

import { getAllLotes } from "@/actions/api"
import { buildLotesReport, type ReportFormat } from "@/actions/reports"

export const dynamic = "force-dynamic"

// GET /api/reportes/lotes?format=csv|json&loteId=...&desde=...&hasta=...
//
// Genera un archivo descargable con el historial de lotes del backend.
// `loteId` (si está presente) tiene precedencia sobre el rango de fechas.
// El cuerpo se serializa con charset UTF-8; el CSV incluye BOM para que
// Excel detecte el encoding sin mostrar caracteres rotos.
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams
    const formatParam = (params.get("format") ?? "csv").toLowerCase()
    if (formatParam !== "csv" && formatParam !== "json") {
        return Response.json(
            { success: false, message: "Formato no soportado. Usá csv o json." },
            { status: 400 },
        )
    }
    const format = formatParam as ReportFormat

    let runs
    try {
        runs = await getAllLotes()
    } catch (e) {
        return Response.json(
            {
                success: false,
                message: e instanceof Error ? e.message : "Error desconocido",
            },
            { status: 502 },
        )
    }

    const report = buildLotesReport(runs, {
        format,
        loteId: params.get("loteId"),
        desde: params.get("desde"),
        hasta: params.get("hasta"),
    })

    return new Response(report.body, {
        status: 200,
        headers: {
            "content-type": report.contentType,
            "content-disposition": `attachment; filename="${report.filename}"`,
            "cache-control": "private, no-store",
            "x-report-rows": String(report.rows),
        },
    })
}