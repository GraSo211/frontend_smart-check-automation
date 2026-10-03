"use client"

import { useEffect, useState, useTransition } from "react"
import { Play, Square, CheckCircle2, AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate, formatTime } from "@/lib/format"
import type { DecisionControl, LoteSector } from "@/lib/production-data"
import {
    aplicarConsigna,
    getDecisiones,
    startControl,
    stopControl,
} from "@/actions/api"

interface ControlCardProps {
    lote: LoteSector
}

/**
 * Tarjeta de control automático / supervisión (SCA-400).
 *
 * Muestra el modo del lote, las ventanas de evaluación/actualización y los
 * botones Iniciar / Detener (rol Supervisor+) más Aplicar propuesta pendiente
 * (rol Operario+, sólo modo SUPERVISION). Debajo lista las últimas
 * decisiones del MPC con el aplicado_por y los Δ respecto al setpoint.
 */
export function ControlCard({ lote }: ControlCardProps) {
    const modo = lote.modo ?? "MANUAL"
    const horno2 = lote.horno2_habilitado ?? false

    const [decisiones, setDecisiones] = useState<DecisionControl[]>([])
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const refresh = () => {
        startTransition(async () => {
            try {
                const items = await getDecisiones(lote.id)
                setDecisiones(items)
                setErrorMsg(null)
            } catch (e) {
                setErrorMsg(e instanceof Error ? e.message : "Error al cargar decisiones")
            }
        })
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lote.id])

    if (modo === "MANUAL") {
        return (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Lote en modo MANUAL: el sistema no propone ni aplica cambios.
            </div>
        )
    }

    return (
        <div className="rounded-lg border bg-card p-4 space-y-4">
            <header className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="font-semibold">Control del lote</h3>
                    <p className="text-xs text-muted-foreground">
                        Modo: <span className="font-mono">{modo}</span>
                        {horno2 && " · Horno 2 habilitado"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                            startTransition(async () => {
                                await startControl(lote.id)
                                refresh()
                            })
                        }}
                    >
                        <Play className="h-4 w-4" />
                        Iniciar
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                            startTransition(async () => {
                                await stopControl(lote.id)
                                refresh()
                            })
                        }}
                    >
                        <Square className="h-4 w-4" />
                        Detener
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat label="Ventana eval." value={`${lote.ventana_evaluacion_segundos ?? 600} s`} />
                <Stat label="Ventana act." value={`${lote.ventana_actualizacion_segundos ?? 300} s`} />
                <Stat label="Tolerancia T" value={`${lote.tolerancia_temp_c ?? 2} °C`} />
                <Stat
                    label="Umbral %Q / %C"
                    value={`${lote.umbral_aceptacion_quemado ?? 5} / ${lote.umbral_aceptacion_crudo ?? 5}`}
                />
            </div>

            {modo === "SUPERVISION" && (
                <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                    disabled={pending}
                    onClick={() => {
                        startTransition(async () => {
                            await aplicarConsigna(lote.id)
                            refresh()
                        })
                    }}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Aplicar propuesta pendiente
                </button>
            )}

            {errorMsg && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {errorMsg}
                </div>
            )}

            <DecisionesList items={decisiones} />
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className="font-mono text-sm">{value}</p>
        </div>
    )
}

function DecisionesList({ items }: { items: DecisionControl[] }) {
    if (items.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                Aún no hay decisiones registradas para este lote.
            </p>
        )
    }
    return (
        <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Decisiones recientes
            </h4>
            <ul className="space-y-1 text-xs">
                {items.slice(0, 10).map((d) => (
                    <li
                        key={d.id}
                        className={cn(
                            "rounded-md p-2",
                            d.aplicado_por === "NADIE"
                                ? "bg-amber-50 dark:bg-amber-950/30"
                                : "bg-muted/40",
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">
                                {d.aplicado_por} · T1={d.temp_propuesto.toFixed(1)}°C · V={d.vel_propuesto.toFixed(2)}m/s
                            </span>
                            <span className="text-muted-foreground">
                                {formatDate(d.created_at)} · {formatTime(d.created_at)}
                            </span>
                        </div>
                        {d.razon_skipped && (
                            <p className="mt-1 text-red-600">skip: {d.razon_skipped}</p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}