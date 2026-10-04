"use client"

import { useMemo, useState } from "react"
import { FileDown, FileJson, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReportesFormProps {
    initialFilters: {
        loteId: string
        desde: string
        hasta: string
    }
}

/**
 * Filtros del reporte + dos botones de descarga (CSV / JSON). Construye la URL
 * del Route Handler `/api/reportes/lotes` con los params vigentes. La descarga
 * se dispara abriendo la URL y dejando que el navegador maneje el
 * `Content-Disposition: attachment`.
 */
export function ReportesForm({ initialFilters }: ReportesFormProps) {
    const [loteId, setLoteId] = useState(initialFilters.loteId)
    const [desde, setDesde] = useState(initialFilters.desde)
    const [hasta, setHasta] = useState(initialFilters.hasta)

    const params = useMemo(
        () => buildParams({ loteId, desde, hasta }),
        [loteId, desde, hasta],
    )

    const queryString = params.toString()
    const csvHref = `/api/reportes/lotes${queryString ? `?${queryString}&` : "?"}format=csv`
    const jsonHref = `/api/reportes/lotes${queryString ? `?${queryString}&` : "?"}format=json`

    const hasFilter = loteId !== "" || desde !== "" || hasta !== ""

    return (
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <div className="sm:col-span-2">
                <label
                    htmlFor="reportes-loteId"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                    Lote específico
                </label>
                <input
                    id="reportes-loteId"
                    type="text"
                    inputMode="text"
                    value={loteId}
                    onChange={(event) => setLoteId(event.target.value)}
                    placeholder="l-…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                    Si completás este campo, ignora el rango de fechas.
                </p>
            </div>

            <div>
                <label
                    htmlFor="reportes-desde"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                    Desde
                </label>
                <input
                    id="reportes-desde"
                    type="date"
                    value={desde}
                    onChange={(event) => setDesde(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
            </div>

            <div>
                <label
                    htmlFor="reportes-hasta"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                    Hasta
                </label>
                <input
                    id="reportes-hasta"
                    type="date"
                    value={hasta}
                    onChange={(event) => setHasta(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <span
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                        hasFilter
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary/70 text-muted-foreground",
                    )}
                >
                    <Filter className="size-3.5" aria-hidden="true" />
                    {hasFilter ? "Filtros activos" : "Sin filtros (todo el historial)"}
                </span>

                <div className="ml-auto flex flex-wrap gap-2">
                    <a
                        href={csvHref}
                        download
                        aria-label="Descargar CSV"
                        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <FileDown className="size-4" />
                        CSV
                    </a>
                    <a
                        href={jsonHref}
                        download
                        aria-label="Descargar JSON"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <FileJson className="size-4" />
                        JSON
                    </a>
                </div>
            </div>
        </form>
    )
}

function buildParams(input: { loteId: string; desde: string; hasta: string }): URLSearchParams {
    const params = new URLSearchParams()
    if (input.loteId) params.set("loteId", input.loteId)
    if (input.desde) params.set("desde", toIsoFromInput(input.desde))
    if (input.hasta) params.set("hasta", toIsoFromInput(input.hasta))
    return params
}

// `<input type="date">` entrega `YYYY-MM-DD`. El backend espera ISO completo;
// la medianoche UTC es la convención acá porque no tenemos un campo de hora en
// el filtro. Si hace falta precisión finer-grained, sumamos un selector de
// hora en una iteración futura.
function toIsoFromInput(raw: string): string {
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}