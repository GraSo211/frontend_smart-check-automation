import type { Metadata } from "next"
import Link from "next/link"
import { FileBarChart, FileDown, FileJson, ShieldCheck } from "lucide-react"
import { ReportesForm } from "@/components/reportes/reportes-form"

export const metadata: Metadata = {
    title: "Reportes | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

interface PageProps {
    searchParams: Promise<{
        loteId?: string | string[]
        desde?: string | string[]
        hasta?: string | string[]
    }>
}

function firstParam(value: string | string[] | undefined): string {
    const raw = Array.isArray(value) ? value[0] : value
    return raw ?? ""
}

/**
 * Centro de reportes: el usuario arma un conjunto de filtros (lote específico o
 * rango de fechas) y dispara la descarga de un CSV o JSON. La descarga se hace
 * vía el Route Handler `/api/reportes/lotes`, que es la única ruta que arma el
 * cuerpo: la UI nunca toca el backend directamente.
 */
export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams
    const filters = {
        loteId: firstParam(params.loteId),
        desde: firstParam(params.desde),
        hasta: firstParam(params.hasta),
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                        <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
                        Reportes
                    </div>
                    <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Exportación de lotes
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Filtrá por lote o por rango de fechas y descargá el historial en CSV
                        (con BOM UTF-8) o JSON.
                    </p>
                </header>

                <section
                    aria-label="Filtros del reporte"
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                    <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileBarChart className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                Filtros
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                El loteId tiene precedencia sobre el rango. Si lo dejás
                                vacío, exporta todo el historial disponible.
                            </p>
                        </div>
                    </header>
                    <div className="p-5">
                        <ReportesForm initialFilters={filters} />
                    </div>
                </section>

                <section
                    aria-label="Sobre los formatos"
                    className="mt-6 grid gap-4 sm:grid-cols-2"
                >
                    <FormatHint
                        title="CSV"
                            icon={<FileDown className="size-5" />}
                            accent="bg-success/10 text-success"
                            description="Hoja de cálculo con una fila por lote. Pensado para Excel o Google Sheets: incluye BOM UTF-8 para que los acentos se vean bien."
                    />
                    <FormatHint
                        title="JSON"
                        icon={<FileJson className="size-5" />}
                        accent="bg-info/10 text-info"
                        description="Array de objetos con metadatos (generated_at, total) y la lista de lotes completa. Útil para integraciones o scripts."
                    />
                </section>

                <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    La descarga respeta los permisos de tu rol. Si el backend rechaza
                    la consulta, vas a ver el error en la página de lotes.
                    <Link
                        href="/lotes"
                        className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Ir al historial
                    </Link>
                </p>
            </main>
        </div>
    )
}

function FormatHint({
    title,
    icon,
    description,
    accent,
}: {
    title: string
    icon: React.ReactNode
    description: string
    accent: string
}) {
    return (
        <article className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                {icon}
            </span>
            <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
        </article>
    )
}