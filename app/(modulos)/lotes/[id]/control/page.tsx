import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ControlCard } from "@/components/lotes/control-card"
import { getDecisiones, getLoteAbierto, getSectores } from "@/actions/api"
import { getSession, hasMinRole } from "@/lib/auth"
import type { DecisionControl, LoteSector, Sector } from "@/lib/production-data"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
}

/**
 * Vista de control automático / supervisión por lote (SCA-400 / A6).
 *
 * Server component: carga el lote abierto del sector (la Pi lo identifica
 * por sector; el id del path es el lote_id) más las últimas decisiones del
 * MPC y delega la interactividad (Iniciar/Detener/Aplicar) al ControlCard
 * cliente. El dashboard global queda como entrada; este detalle es para
 * cuando el operario ya eligió uno del listado.
 *
 * Reglas de acceso:
 *   - Cualquier rol autenticado puede ver el estado del control.
 *   - Las mutaciones Iniciar/Detener requieren Supervisor (lo valida el
 *     backend; acá sólo ocultamos el botón si el rol es Operario).
 */
export default async function Page({ params }: PageProps) {
    const { id: rawLoteId } = await params
    const loteId = typeof rawLoteId === "string" ? rawLoteId : ""

    const session = await getSession()
    const userRole = session?.rol ?? "Operario"
    const canControl = hasMinRole(userRole, "Supervisor")

    // El id del path es el lote; para resolver el sector hacemos una pasada
    // por getSectores y getLoteAbierto (el primero que coincida).
    let sectores: Sector[] = []
    try {
        sectores = await getSectores()
    } catch {
        sectores = []
    }

    let lote: LoteSector | null = null
    for (const sector of sectores) {
        try {
            const candidato = await getLoteAbierto(sector.id)
            if (candidato && candidato.id === loteId) {
                lote = candidato
                break
            }
        } catch {
            // seguimos buscando
        }
    }

    if (lote === null) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                    <Link
                        href="/lotes"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                        <ArrowLeft className="h-3 w-3" />
                        Volver a Lotes
                    </Link>
                    <h1 className="mt-4 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Lote no encontrado
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        El lote <span className="font-mono">{loteId}</span> no está abierto en
                        ninguno de los sectores, o la consulta falló.
                    </p>
                </main>
            </div>
        )
    }

    let decisiones: DecisionControl[] = []
    let decisionesError: string | null = null
    try {
        decisiones = await getDecisiones(lote.id, 20)
    } catch (e) {
        decisionesError =
            e instanceof Error ? e.message : "No se pudieron cargar las decisiones del MPC."
    }

    const modo = lote.modo ?? "MANUAL"

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <Link
                    href="/lotes"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                    <ArrowLeft className="h-3 w-3" />
                    Volver a Lotes
                </Link>

                <header className="mt-4 mb-8">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                        <span
                            className="inline-block size-1.5 rounded-full bg-accent"
                            aria-hidden="true"
                        />
                        Control automático
                    </div>
                    <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {lote.producto_nombre}
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Lote <span className="font-mono">{lote.id}</span> · Sector{" "}
                        <span className="font-mono">{lote.sector_id}</span>
                    </p>
                </header>

                {!canControl && modo !== "MANUAL" && (
                    <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        Tu rol <span className="font-mono">{userRole}</span> sólo permite visualizar
                        el control. Para iniciar/detener el loop necesitás rol Supervisor o
                        Administrador.
                    </p>
                )}

                <ControlCard lote={lote} canControl={canControl} />

                {decisionesError && (
                    <p className="mt-4 text-xs text-red-600">{decisionesError}</p>
                )}
                {/* El ControlCard ya lista las decisiones (las vuelve a leer
                    en cliente); dejamos el fetch server-side sólo para que el
                    primer render ya tenga datos sin esperar al useEffect. */}
                {decisiones.length > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                        {decisiones.length} decisiones pre-cargadas en el servidor.
                    </p>
                )}
            </main>
        </div>
    )
}