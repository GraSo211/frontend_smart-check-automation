import { NextRequest } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"

import { getReporteTrazabilidad } from "@/actions/api"
import { ApiError } from "@/lib/api-client"
import { isLoteUUID } from "@/lib/reportes"
import {
    buildTrazabilidadCsv,
    isTrazabilidadDataset,
    type TrazabilidadDataset,
    type TrazabilidadDelimiter,
} from "@/lib/reportes-trazabilidad-csv"
import { ReporteTrazabilidad } from "@/lib/reportes-pdf/trazabilidad"

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

// GET /api/reportes/trazabilidad?lote_id=<uuid>&format=pdf|csv
//
// Genera el PDF (default) o un CSV de un dataset de trazabilidad de un lote a
// partir de GET /api/v1/reportes/trazabilidad. Los 400/404 del backend se
// propagan.
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams
    const loteId = (params.get("lote_id") ?? "").trim()
    if (!loteId) return badRequest("Falta lote_id.")
    if (!isLoteUUID(loteId)) return badRequest("lote_id inválido: se espera un UUID.")

    const format = (params.get("format") ?? "pdf").toLowerCase()
    if (format !== "pdf" && format !== "csv") {
        return badRequest("Formato no soportado. Usá pdf o csv.")
    }

    const dataset = params.get("dataset") ?? ""
    const rawDelim = params.get("delim")
    let csvOptions: {
        dataset: TrazabilidadDataset
        delimiter?: TrazabilidadDelimiter
    } | null = null
    if (format === "csv") {
        if (!isTrazabilidadDataset(dataset)) {
            return badRequest(
                "dataset inválido: usá proceso, alertas, decisiones o consignas.",
            )
        }
        if (rawDelim !== null && rawDelim !== "," && rawDelim !== ";") {
            return badRequest("delim inválido: usá ',' o ';'.")
        }
        csvOptions = {
            dataset,
            delimiter: rawDelim === "," || rawDelim === ";" ? rawDelim : undefined,
        }
    }

    let data
    try {
        data = await getReporteTrazabilidad(loteId)
    } catch (error) {
        return errorResponse(error)
    }

    if (csvOptions) {
        const csv = buildTrazabilidadCsv(data, csvOptions.dataset, {
            delimiter: csvOptions.delimiter,
        })
        return new Response(csv.body, {
            status: 200,
            headers: {
                "content-type": csv.contentType,
                "content-disposition": `attachment; filename="${csv.filename}"`,
                "cache-control": "private, no-store",
                "x-report-rows": String(csv.rows),
            },
        })
    }

    const document = <ReporteTrazabilidad data={data} generatedAt={new Date()} />
    try {
        const buffer = await renderToBuffer(document)
        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "content-type": "application/pdf",
                "content-disposition": `attachment; filename="trazabilidad-${data.lote.id}.pdf"`,
                "cache-control": "private, no-store",
            },
        })
    } catch (error) {
        return errorResponse(error)
    }
}
