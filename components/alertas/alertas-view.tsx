"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, CircleAlert, Info, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { ackAlerta } from "@/actions/api"
import { cn } from "@/lib/utils"
import { formatDate, formatTime } from "@/lib/format"
import type { Alerta, AlertaEstado } from "@/lib/production-data"

interface AlertasViewProps {
    initialAlertas: Alerta[]
    initialEstado: AlertaEstado | "TODAS"
    error: string | null
    /** Habilita el acuse de recibo. Lo decide la página desde `hasMinRole`. */
    canAck: boolean
}

const ESTADOS: Array<{ id: AlertaEstado | "TODAS"; label: string }> = [
    { id: "ACTIVA", label: "Activas" },
    { id: "ACK", label: "Reconocidas" },
    { id: "RESUELTA", label: "Resueltas" },
    { id: "TODAS", label: "Todas" },
]

/**
 * Vista del centro de alertas. Filtra por estado vía URL (`?estado=ACTIVA`)
 * y dispara el acuse de recibo vía la server action `ackAlerta` cuando el
 * usuario tiene rol Supervisor+. El rollback del ack optimista es simple:
 * la server action revalida la página (`revalidatePath("/alertas")`) cuando
 * termina, así que no hace falta mantener un cache local.
 */
export function AlertasView({
    initialAlertas,
    initialEstado,
    error,
    canAck,
}: AlertasViewProps) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()

    const navigateEstado = (estado: AlertaEstado | "TODAS") => {
        const target = estado === "TODAS" ? "/alertas" : `/alertas?estado=${estado}`
        startTransition(() => router.push(target))
    }

    return (
        <div className="space-y-6">
            <div role="tablist" className="flex flex-wrap gap-2">
                {ESTADOS.map((estado) => {
                    const selected = estado.id === initialEstado
                    return (
                        <button
                            key={estado.id}
                            role="tab"
                            aria-selected={selected}
                            type="button"
                            onClick={() => navigateEstado(estado.id)}
                            disabled={pending}
                            className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                "disabled:cursor-not-allowed disabled:opacity-60",
                                selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-secondary/40 text-foreground hover:bg-secondary",
                            )}
                        >
                            {estado.label}
                        </button>
                    )
                })}
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
                >
                    No se pudieron cargar las alertas: {error}
                </div>
            )}

            {initialAlertas.length === 0 ? (
                <EmptyState estado={initialEstado} />
            ) : (
                <ul className="space-y-3">
                    {initialAlertas.map((alerta) => (
                        <AlertaItem
                            key={alerta.id}
                            alerta={alerta}
                            canAck={canAck}
                            pending={pending}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}

function EmptyState({ estado }: { estado: AlertaEstado | "TODAS" }) {
    const label = estado === "TODAS" ? "registradas" : `en estado ${estado.toLowerCase()}`
    return (
        <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-sm text-muted-foreground"
        >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div>
                <p className="font-semibold text-foreground">
                    Sin alertas {label}
                </p>
                <p className="mt-1 text-xs">
                    Cuando el backend emita una alerta la vas a ver acá.
                </p>
            </div>
        </div>
    )
}

function SeveridadIcon({
    severidad,
    className,
}: {
    severidad: Alerta["severidad"]
    className?: string
}) {
    if (severidad === "CRITICAL") {
        return <ShieldAlert className={className} aria-hidden="true" />
    }
    if (severidad === "WARNING") {
        return <CircleAlert className={className} aria-hidden="true" />
    }
    return <Info className={className} aria-hidden="true" />
}

function AlertaItem({
    alerta,
    canAck,
    pending,
}: {
    alerta: Alerta
    canAck: boolean
    pending: boolean
}) {
    const [isAcking, startAckTransition] = useTransition()
    const tone = severidadTone(alerta.severidad)
    const handleAck = () => {
        startAckTransition(async () => {
            const result = await ackAlerta(alerta.id)
            if (!result.ok) {
                toast.error("No se pudo reconocer la alerta", {
                    description: result.errors.join(" · "),
                })
            }
        })
    }
    return (
        <li
            className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between",
                alerta.estado === "ACK" && "border-warning/40",
                alerta.estado === "RESUELTA" && "border-success/40 opacity-80",
            )}
        >
            <div className="flex items-start gap-3">
                <span
                    className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        tone.bg,
                    )}
                >
                    <SeveridadIcon severidad={alerta.severidad} className={cn("size-5", tone.fg)} />
                </span>
                <div className="min-w-0">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {alerta.tipo}
                        {alerta.sector_id ? ` · ${alerta.sector_id}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                        {alerta.mensaje}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(alerta.created_at)} · {formatTime(alerta.created_at)}
                        {alerta.lote_id ? ` · lote ${alerta.lote_id}` : ""}
                        {(alerta.estado === "ACK" || alerta.estado === "RESUELTA") && alerta.acked_por
                            ? ` · ACK por ${alerta.acked_por.nombre}`
                            : ""}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
                <EstadoBadge estado={alerta.estado} />
                {canAck && alerta.estado === "ACTIVA" && (
                    <button
                        type="button"
                        onClick={handleAck}
                        disabled={pending || isAcking}
                        aria-label={`Reconocer alerta ${alerta.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        {isAcking ? "Reconociendo…" : "Reconocer"}
                    </button>
                )}
            </div>
        </li>
    )
}

function EstadoBadge({ estado }: { estado: Alerta["estado"] }) {
    const tone = estadoTone(estado)
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ring-1 ring-inset",
                tone,
            )}
        >
            {labelEstado(estado)}
        </span>
    )
}

function labelEstado(estado: Alerta["estado"]): string {
    if (estado === "ACTIVA") return "Activa"
    if (estado === "ACK") return "Reconocida"
    return "Resuelta"
}

function estadoTone(estado: Alerta["estado"]): string {
    if (estado === "ACTIVA") return "bg-destructive/10 text-destructive ring-destructive/25"
    if (estado === "ACK") return "bg-warning/10 text-warning ring-warning/25"
    return "bg-success/10 text-success ring-success/25"
}

function severidadTone(sev: Alerta["severidad"]): { bg: string; fg: string } {
    if (sev === "CRITICAL") return { bg: "bg-destructive/10", fg: "text-destructive" }
    if (sev === "WARNING") return { bg: "bg-warning/10", fg: "text-warning" }
    return { bg: "bg-info/10", fg: "text-info" }
}