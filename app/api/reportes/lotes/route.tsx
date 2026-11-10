import { NextRequest } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"

import {
    getAllReporteLotes,
    getReporteLotes,
    getReporteOEE,
    getReporteResumen,
} from "@/actions/api"
import { buildLotesReport, type ReportFormat } from "@/actions/reports"
import { ApiError } from "@/lib/api-client"
import { ReporteOperativo } from "@/lib/reportes-pdf/reporte-operativo"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

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

// GET /api/reportes/lotes?format=csv|json|pdf&desde&hasta&sector_id&producto_id&turno&delim
//
// Genera un archivo descargable con el detalle del período que expone
// GET /api/v1/reportes/lotes. El CSV incluye BOM para que Excel detecte UTF-8.
// El PDF usa @react-pdf/renderer (Helvetica built-in, runtime Node).
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams
    const formatParam = (params.get("format") ?? "csv").toLowerCase()

    const filtros = {
        desde: params.get("desde"),
        hasta: params.get("hasta"),
        sectorId: params.get("sector_id"),
        productoId: params.get("producto_id"),
        turno: params.get("turno"),
    }

    if (formatParam === "pdf") {
        try {
            const [[resumen, detalle], oee] = await Promise.all([
                Promise.all([
                    getReporteResumen(filtros),
                    getReporteLotes(filtros, { limite: 150 }),
                ]),
                // El OEE es opcional: si el backend falla, el PDF sigue sin esa página.
                getReporteOEE({
                    desde: filtros.desde,
                    hasta: filtros.hasta,
                    sectorId: filtros.sectorId,
                }).catch(() => null),
            ])
            const buffer = await renderToBuffer(
                <ReporteOperativo
                    resumen={resumen}
                    lotes={detalle.lotes}
                    oee={oee}
                    filtros={resumen.filtros}
                    generatedAt={new Date()}
                    sectorNombre={filtros.sectorId ? detalle.lotes[0]?.sector_nombre : undefined}
                    productoNombre={filtros.productoId ? detalle.lotes[0]?.producto_nombre : undefined}
                    truncated={detalle.siguienteCursor !== null}
                />,
            )
            const desde = resumen.periodo.desde.slice(0, 10).replace(/[^0-9-]/g, "") || "inicio"
            const hasta = resumen.periodo.hasta.slice(0, 10).replace(/[^0-9-]/g, "") || "hoy"
            return new Response(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    "content-type": "application/pdf",
                    "content-disposition": `attachment; filename="reporte-operativo-${desde}_a_${hasta}.pdf"`,
                    "cache-control": "private, no-store",
                    "x-report-rows": String(detalle.lotes.length),
                    "x-report-truncated": String(detalle.siguienteCursor !== null),
                },
            })
        } catch (e) {
            return errorResponse(e)
        }
    }

    if (formatParam !== "csv" && formatParam !== "json") {
        return Response.json(
            { success: false, message: "Formato no soportado. Usá csv, json o pdf." },
            { status: 400 },
        )
    }
    const format = formatParam as ReportFormat

    const delimParam = params.get("delim")
    if (delimParam !== null && delimParam !== "," && delimParam !== ";") {
        return Response.json(
            { success: false, message: "Delimitador no soportado. Usá , o ;." },
            { status: 400 },
        )
    }
    const delimiter = delimParam === ";" ? ";" : ","

    let result
    try {
        result = await getAllReporteLotes(filtros)
    } catch (e) {
        return errorResponse(e)
    }

    const report = buildLotesReport(result.lotes, { format, delimiter, ...filtros })

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
