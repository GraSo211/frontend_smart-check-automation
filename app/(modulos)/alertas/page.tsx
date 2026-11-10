import type { Metadata } from "next"
import { Lock, ShieldAlert } from "lucide-react"
import { getAlertas } from "@/actions/api"
import { getSession, hasMinRole } from "@/lib/auth"
import type { AlertaEstado } from "@/lib/production-data"
import { AlertasView } from "@/components/alertas/alertas-view"

export const metadata: Metadata = {
    title: "Manejo de Alertas | SmartCheck Automation",
}

export const dynamic = "force-dynamic"

interface PageProps {
    searchParams: Promise<{ estado?: string | string[] }>
}

function firstParam(value: string | string[] | undefined): string {
    const raw = Array.isArray(value) ? value[0] : value
    return raw ?? ""
}

const ESTADOS_VALIDOS: Array<AlertaEstado | "TODAS"> = [
    "ACTIVA",
    "ACK",
    "RESUELTA",
    "TODAS",
]

/**
 * Centro de alertas operativas. Filtra por estado vía query param
 * (`?estado=ACTIVA|ACK|RESUELTA`; por defecto "ACTIVA"). El acuse de recibo
 * requiere rol Supervisor+ y se dispara desde el cliente vía `ackAlerta`.
 */
export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams
    const requestedEstado = firstParam(params.estado)
    const estado: AlertaEstado | "TODAS" = ESTADOS_VALIDOS.includes(
        requestedEstado as AlertaEstado | "TODAS",
    )
        ? (requestedEstado as AlertaEstado | "TODAS")
        : "ACTIVA"

    const session = await getSession()
    const canAck = session ? hasMinRole(session.rol, "Supervisor") : false

    let initialAlertas: Awaited<ReturnType<typeof getAlertas>> = []
    let error: string | null = null
    try {
        initialAlertas = await getAlertas(
            estado === "TODAS" ? undefined : { estado },
        )
    } catch (e) {
        error = e instanceof Error ? e.message : "Error desconocido"
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                                <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
                                Manejo de Alertas
                            </div>
                            <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                Alertas operativas
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                                Acusá recibo de las alertas para que el equipo sepa que las
                                viste. Las alertas resueltas quedan en el histórico para
                                auditoría.
                            </p>
                        </div>
                        {!canAck && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                <Lock className="size-3.5" aria-hidden="true" />
                                Sólo lectura · Operario
                            </span>
                        )}
                    </div>
                </header>

                <section
                    aria-label="Listado de alertas"
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                    <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                            <ShieldAlert className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                Listado
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {initialAlertas.length} alertas{" "}
                                {estado === "TODAS" ? "en total" : `en estado ${estado.toLowerCase()}`}.
                            </p>
                        </div>
                    </header>
                    <div className="p-5">
                        <AlertasView
                            initialAlertas={initialAlertas}
                            initialEstado={estado}
                            error={error}
                            canAck={canAck}
                        />
                    </div>
                </section>
            </main>
        </div>
    )
}