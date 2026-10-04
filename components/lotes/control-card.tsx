"use client"

import { useEffect, useState, useTransition } from "react"
import { Play, Square, CheckCircle2, AlertTriangle, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatDate, formatTime, formatTemp } from "@/lib/format"
import type { DecisionControl, LoteSector, SetpointPropuesto } from "@/lib/production-data"
import {
    aplicarConsigna,
    getConsignaPropuesta,
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
 * (rol Operario+, sólo modo SUPERVISION). La aplicación abre un modal de
 * confirmación con los ΔT1/ΔT2/ΔV respecto al setpoint actual antes de
 * despachar al horno. Debajo lista las últimas decisiones del MPC.
 */
export function ControlCard({ lote }: ControlCardProps) {
    const modo = lote.modo ?? "MANUAL"
    const horno2 = lote.horno2_habilitado ?? false

    const [decisiones, setDecisiones] = useState<DecisionControl[]>([])
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const [modalOpen, setModalOpen] = useState(false)
    const [propuesta, setPropuesta] = useState<SetpointPropuesto | null>(null)
    const [loadingPropuesta, setLoadingPropuesta] = useState(false)
    const [aplicarError, setAplicarError] = useState<string | null>(null)

    const [propuestaPendiente, setPropuestaPendiente] = useState<SetpointPropuesto | null>(null)
    const [sseConnected, setSseConnected] = useState(false)

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

    // SSE: el backend emite `control.propuesta` cuando el Loop del MPC
    // propone un nuevo setpoint. Esto actualiza la UI sin que el operario
    // tenga que abrir el modal manualmente para descubrir si hay propuesta.
    useEffect(() => {
        if (modo === "MANUAL") return
        const es = new EventSource(`/api/lotes/${encodeURIComponent(lote.id)}/control/events`)
        es.onopen = () => setSseConnected(true)
        es.onerror = () => setSseConnected(false)
        es.addEventListener("control.propuesta", (ev) => {
            try {
                const payload = JSON.parse((ev as MessageEvent).data) as { propuesta?: SetpointPropuesto }
                if (payload.propuesta) {
                    setPropuestaPendiente(payload.propuesta)
                }
            } catch {
                // payload mal formado, ignorar
            }
        })
        return () => {
            es.close()
            setSseConnected(false)
        }
    }, [lote.id, modo])

    if (modo === "MANUAL") {
        return (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Lote en modo MANUAL: el sistema no propone ni aplica cambios.
            </div>
        )
    }

    const abrirModalAplicar = () => {
        setAplicarError(null)
        setPropuesta(null)
        setModalOpen(true)
        setLoadingPropuesta(true)
        // Si el SSE ya trajo una propuesta, la usamos directamente; si no,
        // hacemos pull al endpoint GET para sincronizar.
        if (propuestaPendiente) {
            setPropuesta(propuestaPendiente)
            setLoadingPropuesta(false)
            return
        }
        startTransition(async () => {
            try {
                const p = await getConsignaPropuesta(lote.id)
                setPropuesta(p)
                if (p === null) {
                    setAplicarError("No hay propuesta pendiente para este lote.")
                }
            } catch (e) {
                setAplicarError(
                    e instanceof Error ? e.message : "No se pudo consultar la propuesta.",
                )
            } finally {
                setLoadingPropuesta(false)
            }
        })
    }

    const confirmarAplicar = () => {
        if (propuesta === null) return
        setLoadingPropuesta(true)
        startTransition(async () => {
            try {
                const result = await aplicarConsigna(lote.id)
                if (!result.ok) {
                    setAplicarError(result.errors.join(" · "))
                    return
                }
                setModalOpen(false)
                setPropuesta(null)
                setPropuestaPendiente(null)
                refresh()
            } catch (e) {
                setAplicarError(
                    e instanceof Error ? e.message : "Error al aplicar la consigna.",
                )
            } finally {
                setLoadingPropuesta(false)
            }
        })
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
                    <Button
                        size="sm"
                        onClick={() => {
                            startTransition(async () => {
                                await startControl(lote.id)
                                refresh()
                            })
                        }}
                        disabled={pending}
                    >
                        <Play className="h-4 w-4" />
                        Iniciar
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            startTransition(async () => {
                                await stopControl(lote.id)
                                refresh()
                            })
                        }}
                        disabled={pending}
                    >
                        <Square className="h-4 w-4" />
                        Detener
                    </Button>
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={abrirModalAplicar}
                        disabled={pending}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Aplicar propuesta pendiente
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                            className={cn(
                                "inline-block size-2 rounded-full",
                                sseConnected ? "bg-emerald-500" : "bg-muted-foreground/40",
                            )}
                            aria-hidden="true"
                        />
                        {propuestaPendiente
                            ? "Propuesta del MPC disponible"
                            : sseConnected
                                ? "Esperando propuesta del MPC"
                                : "Stream SSE desconectado"}
                    </div>
                </div>
            )}

            {errorMsg && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {errorMsg}
                </div>
            )}

            <DecisionesList items={decisiones} />

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Aplicar propuesta del MPC</DialogTitle>
                        <DialogDescription>
                            Revisá los Δ respecto al setpoint actual antes de despachar al horno.
                        </DialogDescription>
                    </DialogHeader>

                    {loadingPropuesta && !propuesta ? (
                        <p className="text-sm text-muted-foreground">Buscando propuesta…</p>
                    ) : propuesta === null ? (
                        <p className="text-sm text-amber-600">
                            {aplicarError ?? "No hay propuesta pendiente."}
                        </p>
                    ) : (
                        <PropuestaResumen
                            propuesta={propuesta}
                            horno2={horno2}
                            tempActual={lote.temp1_objetivo ?? null}
                            velActual={lote.vel_objetivo ?? null}
                            temp2Actual={lote.temp2_objetivo ?? null}
                        />
                    )}

                    {aplicarError && propuesta !== null && (
                        <p className="text-xs text-red-600">{aplicarError}</p>
                    )}

                    <DialogFooter>
                        <DialogClose
                            render={<Button variant="outline" disabled={loadingPropuesta} />}
                        >
                            <XIcon className="h-4 w-4" />
                            Cancelar
                        </DialogClose>
                        <Button
                            disabled={loadingPropuesta || propuesta === null}
                            onClick={confirmarAplicar}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Confirmar y aplicar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function PropuestaResumen({
    propuesta,
    horno2,
    tempActual,
    velActual,
    temp2Actual,
}: {
    propuesta: SetpointPropuesto
    horno2: boolean
    tempActual: number | null
    velActual: number | null
    temp2Actual: number | null
}) {
    const dT1 = tempActual !== null ? propuesta.temp1 - tempActual : null
    const dV = velActual !== null ? propuesta.velocidad - velActual : null
    const dT2 =
        horno2 && propuesta.temp2 !== null && propuesta.temp2 !== undefined && temp2Actual !== null
            ? propuesta.temp2 - temp2Actual
            : null

    return (
        <div className="grid grid-cols-2 gap-3 text-sm">
            <Delta label="T1 propuesto" value={formatTemp(propuesta.temp1)} delta={dT1} unit="°C" />
            <Delta
                label="V propuesta"
                value={`${propuesta.velocidad.toFixed(2)} m/s`}
                delta={dV}
                unit="m/s"
                scale={2}
            />
            {horno2 && propuesta.temp2 !== null && propuesta.temp2 !== undefined && (
                <Delta
                    label="T2 propuesto"
                    value={formatTemp(propuesta.temp2)}
                    delta={dT2}
                    unit="°C"
                />
            )}
            <div className="rounded-md border bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Z predicha</p>
                <p className="font-mono text-sm">{propuesta.z.toFixed(2)}</p>
            </div>
        </div>
    )
}

function Delta({
    label,
    value,
    delta,
    unit,
    scale,
}: {
    label: string
    value: string
    delta: number | null
    unit: string
    scale?: number
}) {
    const deltaFmt =
        delta === null
            ? "—"
            : `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-AR", {
                maximumFractionDigits: scale ?? 1,
            })} ${unit}`
    const tone =
        delta === null
            ? "text-muted-foreground"
            : Math.abs(delta) < 0.001
              ? "text-muted-foreground"
              : "text-foreground"
    return (
        <div className="rounded-md border bg-muted/40 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className="font-mono text-sm">{value}</p>
            <p className={cn("font-mono text-xs", tone)}>Δ {deltaFmt}</p>
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
                        {d.prediccion && (
                            <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                                Modelo: {d.prediccion.modelVersion}
                                {d.prediccion.esPlaceholder && " · placeholder"}
                            </p>
                        )}
                        {d.razon_skipped && (
                            <p className="mt-1 text-red-600">skip: {d.razon_skipped}</p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}