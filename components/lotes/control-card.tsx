"use client"

import { useEffect, useState, useTransition } from "react"
import {
    AlertTriangle,
    CheckCircle2,
    Play,
    Square,
    Timer,
    XIcon,
} from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import SegmentedControl from "@/components/supervision/segmented-control"
import { cn } from "@/lib/utils"
import { isRecord } from "@/lib/is-record"
import { formatDate, formatTime, formatTemp } from "@/lib/format"
import type {
    ConfianzaClase,
    ControlLimites,
    DecisionControl,
    LoteSector,
    MetricaHorno,
    SetpointPropuesto,
} from "@/lib/production-data"
import {
    aplicarConsigna,
    cambiarModo,
    getConfianzaClases,
    getConsignaPropuesta,
    getDecisiones,
    getMetricasHorno,
    startControl,
    stopControl,
    updateControlParams,
} from "@/actions/api"

type ModoOperacion = NonNullable<LoteSector["modo"]>

interface ControlCardProps {
    lote: LoteSector
    /**
     * Habilita la mutación de modo (`PATCH /lotes/{id}/modo`). La página pasa
     * el valor server-side desde `hasMinRole(session.rol, "Supervisor")`. Sin
     * este prop, el card es read-only (rol Operario).
     */
    canControl: boolean
}

const MODE_OPTIONS: Array<{ id: ModoOperacion; label: string }> = [
    { id: "MANUAL", label: "Manual" },
    { id: "SUPERVISION", label: "Supervisión" },
    { id: "AUTOMATICO", label: "Automático" },
]

/**
 * Tarjeta de control automático / supervisión (SCA-400).
 *
 * Encabezado con selector de modo (MANUAL / SUPERVISION / AUTOMATICO) cuando
 * `canControl` es true; sin permisos, el modo se muestra como texto plano.
 * - Cambios AUTO/SUPERVISION → MANUAL requieren confirmación porque cancelan
 *   el loop de control del MPC.
 * - El cambio aplica de forma optimista (UI refleja el modo nuevo mientras
 *   viaja la mutación) y revierte si la acción falla.
 * - El SSE `control.evento` confirma el modo definitivo (con lo que también
 *   sincroniza pestañas seleccionadas del card tras una mutación).
 * - En modo SUPERVISION lista la propuesta pendiente del MPC (SSE + pull).
 * - En modo AUTOMATICO sólo expone Iniciar/Detener; el MPC aplica solo.
 * - En modo MANUAL colapsa el cuerpo: el sistema no propone ni aplica nada.
 */
export function ControlCard({ lote, canControl }: ControlCardProps) {
    const initialModo: ModoOperacion = lote.modo ?? "MANUAL"

    // Estado local del modo: separado del prop para soportar optimistic updates
    // y revertir al valor del servidor sin re-renderizar toda la página. El SSE
    // `control.evento` y la respuesta del PATCH son los que sincronizan este
    // estado; evitamos un effect de sync-from-prop (cascading render) porque la
    // página padre ya se revalida y remonta el card cuando cambia `lote.id`.
    const [modoActual, setModoActual] = useState<ModoOperacion>(initialModo)
    const [pendingModo, setPendingModo] = useState(false)
    const [modoError, setModoError] = useState<string | null>(null)
    const [confirmTarget, setConfirmTarget] = useState<ModoOperacion | null>(null)

    const [decisiones, setDecisiones] = useState<DecisionControl[]>([])
    const [metricaActual, setMetricaActual] = useState<MetricaHorno | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const [modalOpen, setModalOpen] = useState(false)
    const [propuesta, setPropuesta] = useState<SetpointPropuesto | null>(null)
    const [loadingPropuesta, setLoadingPropuesta] = useState(false)
    const [aplicarError, setAplicarError] = useState<string | null>(null)
    const [aprobacionNota, setAprobacionNota] = useState<string | null>(null)

    const [propuestaPendiente, setPropuestaPendiente] = useState<SetpointPropuesto | null>(null)
    const [sseConnected, setSseConnected] = useState(false)

    const [accionError, setAccionError] = useState<string | null>(null)

    // Parámetros de control ajustables por Supervisor/Admin.
    const [paramsNota, setParamsNota] = useState<string | null>(null)
    const [paramsError, setParamsError] = useState<string | null>(null)

    // F-F8: confianza agregada del modelo de visión por clase.
    const [confianzaClases, setConfianzaClases] = useState<ConfianzaClase[] | null>(null)
    const [confianzaError, setConfianzaError] = useState<string | null>(null)
    const [confianzaLoading, setConfianzaLoading] = useState(false)

    // Limpia la propuesta pendiente cuando dejamos SUPERVISION: en cualquier
    // otro modo (MANUAL/AUTOMATICO) la propuesta ya no aplica al flujo de UI.
    // Se aplica inline en los handlers que cambian el modo (acción y SSE).
    const clearPropuestaSiNoSupervision = (nextModo: ModoOperacion) => {
        if (nextModo === "SUPERVISION") return
        setPropuestaPendiente(null)
        setPropuesta(null)
    }

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

    const refreshPropuesta = () => {
        startTransition(async () => {
            try {
                const p = await getConsignaPropuesta(lote.id)
                // El 204 limpia la propuesta: la Pi pudo aplicarla.
                setPropuestaPendiente(p)
            } catch {
                // La propuesta se refresca por SSE si el pull falla.
            }
        })
    }

    useEffect(() => {
        refresh()
        const interval = window.setInterval(() => refresh(), 30000)
        return () => window.clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lote.id])

    // En SUPERVISION la propuesta puede aplicarla la Pi sin SSE: pull inicial
    // más sondeo cada 10 s para reflejar la autorización y limpiarla al 204.
    useEffect(() => {
        if (modoActual !== "SUPERVISION") return
        refreshPropuesta()
        const interval = window.setInterval(() => refreshPropuesta(), 10000)
        return () => window.clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modoActual, lote.id])

    // Telemetría del horno en vivo (la Pi publica cada 5 s). Es best-effort:
    // si falla, el panel cae a los valores de la última decisión del MPC.
    useEffect(() => {
        let disposed = false
        const cargar = async () => {
            try {
                const items = await getMetricasHorno(lote.id, 1)
                if (!disposed) setMetricaActual(items[0] ?? null)
            } catch {
                // sin telemetría no se bloquea el control
            }
        }
        void cargar()
        const id = window.setInterval(cargar, 5000)
        return () => {
            disposed = true
            window.clearInterval(id)
        }
    }, [lote.id])

    // F-F8: pull inicial de la confianza agregada del modelo de visión. La UI
    // tolera el array vacío como "sin muestras suficientes" y al backend frío
    // como "endpoint no disponible". El `void` evita que el lint marque el
    // `setState` inicial del effect como render cascada: lo movemos adentro
    // del callback async (la carga arranca en microtask, no en el render).
    useEffect(() => {
        let disposed = false
        void (async () => {
            if (disposed) return
            setConfianzaLoading(true)
            setConfianzaError(null)
            try {
                const clases = await getConfianzaClases(lote.id, 200)
                if (!disposed) setConfianzaClases(clases)
            } catch (e) {
                if (!disposed) {
                    setConfianzaClases([])
                    setConfianzaError(e instanceof Error ? e.message : null)
                }
            } finally {
                if (!disposed) setConfianzaLoading(false)
            }
        })()
        return () => {
            disposed = true
        }
    }, [lote.id])

    /**
     * SSE del backend. Escucha dos eventos:
     * - `control.propuesta`: propuesta pendiente del MPC (modo SUPERVISION).
     * - `control.evento`: confirmación/sincronización de modo operativo. Si el
     *   modo reportado por el servidor difiere del local, ganamos el del
     *   servidor (rollback implícito cuando el backend rechaza un cambio).
     */
    useEffect(() => {
        const es = new EventSource(`/api/lotes/${encodeURIComponent(lote.id)}/control/events`)
        es.onopen = () => setSseConnected(true)
        es.onerror = () => setSseConnected(false)
        es.addEventListener("control.propuesta", (ev) => {
            try {
                const payload: unknown = JSON.parse((ev as MessageEvent).data)
                const parsed = propuestaDesdeSSE(payload)
                if (parsed) setPropuestaPendiente(parsed)
            } catch {
                // payload mal formado, ignorar
            }
        })
        es.addEventListener("control.evento", (ev) => {
            try {
                const payload = JSON.parse((ev as MessageEvent).data) as {
                    lote_id?: string
                    modo?: ModoOperacion
                }
                if (
                    (payload.lote_id === undefined || payload.lote_id === lote.id) &&
                    (payload.modo === "MANUAL" ||
                        payload.modo === "SUPERVISION" ||
                        payload.modo === "AUTOMATICO")
                ) {
                    setModoActual(payload.modo)
                    setPendingModo(false)
                    setModoError(null)
                    setConfirmTarget(null)
                    clearPropuestaSiNoSupervision(payload.modo)
                }
            } catch {
                // payload mal formado, ignorar
            }
        })
        return () => {
            es.close()
            setSseConnected(false)
        }
    }, [lote.id])

    /**
     * Aplica el cambio de modo. Optimistic: muestra el modo nuevo de inmediato;
     * si la acción devuelve error, revierte y expone el mensaje. Si el SSE
     * confirma el mismo modo, también cierra el estado pending.
     */
    const aplicarModo = (target: ModoOperacion) => {
        if (target === modoActual || pendingModo) return
        const previo = modoActual
        setModoActual(target)
        clearPropuestaSiNoSupervision(target)
        setPendingModo(true)
        setModoError(null)
        setAccionError(null)
        setAprobacionNota(null)
        startTransition(async () => {
            try {
                const result = await cambiarModo(lote.id, target)
                if (!result.ok) {
                    setModoActual(previo)
                    clearPropuestaSiNoSupervision(previo)
                    setModoError(result.errors.join(" · "))
                    return
                }
                // El SSE suele confirmar; si la implementación del backend lo
                // omite, sincronizamos igual con la respuesta del PATCH.
                if (result.data.modo && result.data.modo !== target) {
                    setModoActual(result.data.modo)
                    clearPropuestaSiNoSupervision(result.data.modo)
                }
                setConfirmTarget(null)
            } catch (e) {
                setModoActual(previo)
                clearPropuestaSiNoSupervision(previo)
                setModoError(e instanceof Error ? e.message : "Error al cambiar el modo.")
            } finally {
                setPendingModo(false)
            }
        })
    }

    /**
     * Maneja el click del SegmentedControl. Pasar a MANUAL desde un modo con
     * loop potencial (SUPERVISION/AUTOMATICO) requiere confirmación explícita
     * porque cancela el loop.
     */
    const onModeRequest = (target: string) => {
        if (!canControl) return
        if (!isModo(target)) return
        if (target === modoActual) return
        if (target === "MANUAL" && modoActual !== "MANUAL") {
            setConfirmTarget("MANUAL")
            return
        }
        aplicarModo(target)
    }

    const confirmarCambioAManual = () => {
        if (confirmTarget !== "MANUAL") return
        aplicarModo("MANUAL")
    }

    const abrirModalAplicar = () => {
        setAplicarError(null)
        setAprobacionNota(null)
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
        setAprobacionNota(null)
        startTransition(async () => {
            try {
                const result = await aplicarConsigna(lote.id, propuesta.decision_id ?? undefined)
                if (!result.ok) {
                    setAplicarError(result.errors.join(" · "))
                    return
                }
                setModalOpen(false)
                setPropuesta(null)
                setPropuestaPendiente(null)
                setAprobacionNota("Aprobada. La Pi la aplicará en el próximo ciclo.")
                refresh()
            } catch (e) {
                setAplicarError(
                    e instanceof Error ? e.message : "Error al aprobar la consigna.",
                )
            } finally {
                setLoadingPropuesta(false)
            }
        })
    }

    return (
        <div className="rounded-lg border bg-card p-4 space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h3 className="font-semibold">Control del lote</h3>
                    <p className="text-xs text-muted-foreground">
                        Modo:{" "}
                        <span className="font-mono" aria-live="polite">
                            {modoActual}
                        </span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <ModeSelector
                        value={modoActual}
                        onChange={onModeRequest}
                        disabled={!canControl || pendingModo}
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => {
                                setAccionError(null)
                                startTransition(async () => {
                                    try {
                                        const result = await startControl(lote.id)
                                        if (!result.ok) {
                                            setAccionError(result.errors.join(" · "))
                                            return
                                        }
                                        refresh()
                                    } catch (e) {
                                        setAccionError(e instanceof Error ? e.message : "Error al iniciar el control.")
                                    }
                                })
                            }}
                            disabled={pending || !canControl || modoActual === "MANUAL"}
                        >
                            <Play className="h-4 w-4" />
                            Iniciar
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setAccionError(null)
                                startTransition(async () => {
                                    try {
                                        const result = await stopControl(lote.id)
                                        if (!result.ok) {
                                            setAccionError(result.errors.join(" · "))
                                            return
                                        }
                                        refresh()
                                    } catch (e) {
                                        setAccionError(e instanceof Error ? e.message : "Error al detener el control.")
                                    }
                                })
                            }}
                            disabled={pending || !canControl || modoActual === "MANUAL"}
                        >
                            <Square className="h-4 w-4" />
                            Detener
                        </Button>
                    </div>
                </div>
            </header>

            {modoError && (
                <div
                    role="alert"
                    className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    <span>No se pudo cambiar el modo: {modoError}</span>
                </div>
            )}

            {accionError && (
                <div
                    role="alert"
                    className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    <span>{accionError}</span>
                </div>
            )}

            {modoActual === "MANUAL" ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Lote en modo MANUAL: el sistema no propone ni aplica cambios.
                    {canControl && (
                        <span>
                            {" "}
                            Usá el selector superior para volver a un modo con
                            control automático.
                        </span>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Stat label="Ventana eval." value={`${lote.ventana_evaluacion_segundos ?? 600} s`} />
                        <Stat label="Ventana act." value={`${lote.ventana_actualizacion_segundos ?? 300} s`} />
                        <Stat label="Tolerancia T" value={`${lote.tolerancia_temp_c ?? 2} °C`} />
                        <Stat
                            label="Umbral %Q / %C"
                            value={`${lote.umbral_aceptacion_quemado ?? 5} / ${lote.umbral_aceptacion_crudo ?? 5}`}
                        />
                    </div>

                    {lote.estado === "ABIERTO" && canControl && (
                        <ParametrosControl
                            lote={lote}
                            limites={propuestaPendiente?.limites ?? null}
                            onSuccess={() => {
                                setParamsNota("Parámetros actualizados")
                                refreshPropuesta()
                                refresh()
                            }}
                            onError={setParamsError}
                        />
                    )}

                    {paramsNota && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            {paramsNota}
                        </div>
                    )}

                    {paramsError && (
                        <div
                            role="alert"
                            className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                        >
                            <AlertTriangle className="size-3.5" aria-hidden="true" />
                            <span>{paramsError}</span>
                        </div>
                    )}

                    <EstadoActual
                        lote={lote}
                        decision={decisiones[0] ?? null}
                        metrica={metricaActual}
                    />

                    {modoActual === "SUPERVISION" && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={abrirModalAplicar}
                                disabled={pending || !propuestaPendiente || propuestaPendiente.autorizada}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Aprobar propuesta pendiente
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
                                    ? propuestaPendiente.autorizada === false
                                        ? "Pendiente de aprobación"
                                        : "Aprobada: esperando que la Pi la aplique"
                                    : sseConnected
                                        ? "Esperando propuesta del MPC"
                                        : "Stream SSE desconectado"}
                            </div>
                        </div>
                    )}

                    {aprobacionNota && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            {aprobacionNota}
                        </div>
                    )}

                    <CountdownDecisiones
                        ventanaSegundos={lote.ventana_actualizacion_segundos ?? 300}
                        ultimaDecisionEn={decisiones[0]?.created_at ?? null}
                    />

                    <ConfianzaModeloVision
                        clases={confianzaClases}
                        loading={confianzaLoading}
                        error={confianzaError}
                    />

                    {errorMsg && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {errorMsg}
                        </div>
                    )}

                    <DecisionesList items={decisiones} />
                </>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Aprobar propuesta del MPC</DialogTitle>
                        <DialogDescription>
                            Al aprobar, la Raspberry Pi aplicará el setpoint y confirmará al backend. No se escribe al horno desde el panel.
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
                            tempActual={lote.temp1_objetivo ?? null}
                            velActual={lote.vel_objetivo ?? null}
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
                            disabled={loadingPropuesta || propuesta === null || propuesta.autorizada}
                            onClick={confirmarAplicar}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Confirmar aprobación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={confirmTarget === "MANUAL"}
                onOpenChange={(open) => {
                    if (!open) setConfirmTarget(null)
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pasar a modo MANUAL</DialogTitle>
                        <DialogDescription>
                            El loop de control del MPC se cancelará y el sistema
                            dejará de proponer cambios. Vas a tener que iniciarlo
                            manualmente cuando vuelvas a un modo automático.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose
                            render={<Button variant="outline" disabled={pendingModo} />}
                        >
                            <XIcon className="h-4 w-4" />
                            Cancelar
                        </DialogClose>
                        <Button
                            onClick={confirmarCambioAManual}
                            disabled={pendingModo}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {pendingModo ? "Cambiando…" : "Pasar a MANUAL"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ModeSelector({
    value,
    onChange,
    disabled,
}: {
    value: ModoOperacion
    onChange: (id: string) => void
    disabled: boolean
}) {
    return (
        <SegmentedControl
            label="Modo de control"
            options={MODE_OPTIONS}
            value={value}
            onChange={onChange}
            disabled={disabled}
        />
    )
}

function isModo(value: string): value is ModoOperacion {
    return value === "MANUAL" || value === "SUPERVISION" || value === "AUTOMATICO"
}

/**
 * Normaliza el payload SSE `control.propuesta`. El backend serializa
 * `temp1`/`velocidad`/`z` en minúscula; se aceptan también las variantes
 * capitalizadas por compatibilidad con eventos viejos.
 */
function propuestaDesdeSSE(payload: unknown): SetpointPropuesto | null {
    if (!isRecord(payload) || !isRecord(payload.propuesta)) return null
    const raw = payload.propuesta
    const temp1 =
        typeof raw.temp1 === "number"
            ? raw.temp1
            : typeof raw.Temp1 === "number"
              ? raw.Temp1
              : null
    const velocidad =
        typeof raw.velocidad === "number"
            ? raw.velocidad
            : typeof raw.Velocidad === "number"
              ? raw.Velocidad
              : null
    if (temp1 === null || velocidad === null) return null

    return {
        ...(raw as unknown as SetpointPropuesto),
        temp1,
        velocidad,
        z: typeof raw.z === "number" ? raw.z : typeof raw.Z === "number" ? raw.Z : 0,
        autorizada: payload.autorizada === true || raw.autorizada === true,
        decision_id:
            typeof payload.decision_id === "string"
                ? payload.decision_id
                : typeof raw.decision_id === "string"
                  ? raw.decision_id
                  : null,
        limites: isRecord(raw.limites) ? (raw.limites as unknown as ControlLimites) : null,
    }
}

function PropuestaResumen({
    propuesta,
    tempActual,
    velActual,
}: {
    propuesta: SetpointPropuesto
    tempActual: number | null
    velActual: number | null
}) {
    if (!Number.isFinite(propuesta.temp1) || !Number.isFinite(propuesta.velocidad)) {
        return <p className="text-sm text-amber-600">La propuesta no tiene setpoints válidos.</p>
    }

    const dT1 = tempActual !== null ? propuesta.temp1 - tempActual : null
    const dV = velActual !== null ? propuesta.velocidad - velActual : null

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

const RAZON_SKIPPED_LABELS: Record<string, string> = {
    precalentando: "Precalentando horno",
    confianza_baja: "Confianza baja: no se proponen cambios",
    modelo_no_entrenado: "Modelo sin entrenar: automático bloqueado",
    ventana_sin_muestras: "Sin muestras en la ventana",
    receta_sin_setpoint: "El producto no tiene receta de temperatura/velocidad",
    precalentamiento_timeout: "Precalentamiento agotado: revisá el horno",
    restriccion_relajada: "Restricción de calidad relajada",
}

function labelRazonSkipped(razon: string | null | undefined): string | null {
    if (!razon) return null
    return RAZON_SKIPPED_LABELS[razon] ?? null
}

function EstadoActual({
    lote,
    decision,
    metrica,
}: {
    lote: LoteSector
    decision: DecisionControl | null
    metrica: MetricaHorno | null
}) {
    const tempActual = metrica?.temp_horno_1 ?? decision?.temp_actual ?? null
    const velActual = metrica?.velocidad_cinta ?? decision?.vel_actual ?? null
    const tempObj = metrica?.temp_objetivo ?? lote.temp1_objetivo ?? null
    const velObj = metrica?.vel_objetivo ?? lote.vel_objetivo ?? null
    const actualizado = metrica?.received_at ?? decision?.created_at ?? null
    const skippedLabel = labelRazonSkipped(decision?.razon_skipped)

    if (tempActual === null && velActual === null && !decision) {
        return (
            <section aria-label="Estado actual" className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Estado actual
                </h4>
                <p className="text-xs text-muted-foreground">
                    Sin telemetría del horno ni muestras del MPC todavía.
                </p>
            </section>
        )
    }

    return (
        <section aria-label="Estado actual" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Estado actual
                </h4>
                <p className="font-mono text-[10px] text-muted-foreground">
                    {actualizado ? formatDate(actualizado) : "—"}
                    {decision ? ` · ${decision.muestras} muestras` : " · sin evaluación del MPC"}
                </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
                Telemetría cada 5 s. Porcentajes y confianza, de la última evaluación del MPC.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat label="T actual" value={tempActual !== null ? formatTemp(tempActual) : "—"} />
                <Stat label="T objetivo" value={tempObj !== null ? formatTemp(tempObj) : "—"} />
                <Stat
                    label="V actual"
                    value={velActual !== null ? `${velActual.toFixed(2)} m/s` : "—"}
                />
                <Stat label="V objetivo" value={velObj !== null ? `${velObj.toFixed(2)} m/s` : "—"} />
                <Stat label="% OK" value={decision ? `${decision.pct_ok_obs.toFixed(1)}%` : "—"} />
                <Stat label="% Crudos" value={decision ? `${decision.pct_crudos_obs.toFixed(1)}%` : "—"} />
                <Stat label="% Quemados" value={decision ? `${decision.pct_quemados_obs.toFixed(1)}%` : "—"} />
                <Stat
                    label="Confianza"
                    value={
                        decision && decision.conf_promedio > 0
                            ? `${(decision.conf_promedio * 100).toFixed(1)}%`
                            : "—"
                    }
                />
            </div>
            {decision?.razon_skipped && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                    {skippedLabel ?? (
                        <>
                            skip: <span className="font-mono">{decision.razon_skipped}</span>
                        </>
                    )}
                </p>
            )}
            {decision?.prediccion?.esPlaceholder && (
                <p className="text-xs text-destructive">
                    Predicción placeholder: el modelo real todavía no está entrenado.
                </p>
            )}
            {decision?.prediccion?.restriccionRelajada && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                    No hubo candidato que cumpla los límites de crudos/quemados; se eligió el mejor Z.
                </p>
            )}
        </section>
    )
}

// F-F8: panel con la confianza media del modelo de visión por clase sobre las
// últimas detecciones. Cuando el endpoint no existe o no hay muestras todavía
// muestra un estado neutro, no un error bloqueante.
function ConfianzaModeloVision({
    clases,
    loading,
    error,
}: {
    clases: ConfianzaClase[] | null
    loading: boolean
    error: string | null
}) {
    if (loading && clases === null) {
        return (
            <p className="text-xs text-muted-foreground">Consultando confianza del modelo…</p>
        )
    }
    if (error) {
        return (
            <p className="text-xs text-destructive" role="status">
                No se pudo cargar la confianza del modelo: {error}
            </p>
        )
    }
    if (!clases || clases.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                Sin muestras suficientes para calcular la confianza del modelo.
            </p>
        )
    }

    // Orden estable: alfabético por nombre de clase. El backend no garantiza
    // orden, así que normalizamos acá.
    const ordenadas = [...clases].sort((a, b) => a.clase.localeCompare(b.clase))

    return (
        <section aria-label="Confianza del modelo de visión" className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Confianza del modelo de visión
            </h4>
            <ul className="space-y-1.5 text-xs">
                {ordenadas.map((c) => (
                    <ConfianzaBarra key={c.clase} clase={c} />
                ))}
            </ul>
        </section>
    )
}

function ConfianzaBarra({ clase }: { clase: ConfianzaClase }) {
    const mediaPct = Math.max(0, Math.min(1, clase.confianza_media))
    const tone = classTone(clase.clase)
    const stddevPct = clase.confianza_stddev === null ? null : clase.confianza_stddev
    const stddevLabel =
        stddevPct === null
            ? "1 muestra"
            : `±${(stddevPct * 100).toLocaleString("es-AR", {
                  maximumFractionDigits: 1,
              })}%`

    return (
        <li className="rounded-md border bg-muted/30 p-2">
            <div className="flex items-center justify-between gap-2">
                <span className={cn("font-mono text-[11px] font-semibold uppercase", tone.label)}>
                    {clase.clase}
                </span>
                <span className="font-mono tabular-nums text-foreground">
                    {(mediaPct * 100).toFixed(1)}%
                </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-background/80">
                <div
                    className={cn("h-full rounded-full transition-[width]", tone.bar)}
                    style={{ width: `${(mediaPct * 100).toFixed(2)}%` }}
                    aria-hidden="true"
                />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                    {clase.muestras.toLocaleString("es-AR")} muestras · σ {stddevLabel}
                </span>
            </div>
        </li>
    )
}

// Tonos consistentes con la convención existente (ok/ quemado/ crudo).
function classTone(clase: string): { bar: string; label: string } {
    const upper = clase.toUpperCase()
    if (upper === "OK" || upper === "CORRECTO") {
        return { bar: "bg-success", label: "text-success" }
    }
    if (upper === "QUEMADO" || upper === "QUEMADOS") {
        return { bar: "bg-destructive", label: "text-destructive" }
    }
    if (upper === "CRUDO" || upper === "CRUDOS") {
        return { bar: "bg-warning", label: "text-warning" }
    }
    return { bar: "bg-primary", label: "text-primary" }
}

// F-F10: countdown de la próxima decisión del MPC. Se ancla al `created_at` de
// la decisión más reciente y suma la duración de la ventana de actualización.
// Si no hay decisiones previas todavía, muestra "—" (el loop no emitió nada).
function CountdownDecisiones({
    ventanaSegundos,
    ultimaDecisionEn,
}: {
    ventanaSegundos: number
    ultimaDecisionEn: string | null | undefined
}) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [])

    if (!ultimaDecisionEn) {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="size-3.5" aria-hidden="true" />
                Aún no hay decisiones del MPC en este lote.
            </p>
        )
    }

    const lastMs = Date.parse(ultimaDecisionEn)
    if (!Number.isFinite(lastMs)) {
        return null
    }
    const remainingMs = lastMs + ventanaSegundos * 1000 - now
    const remainingSec = Math.max(0, Math.round(remainingMs / 1000))
    const overdue = remainingMs <= 0

    return (
        <p
            className={cn(
                "flex items-center gap-1.5 text-xs",
                overdue ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
            aria-live="polite"
        >
            <Timer className="size-3.5" aria-hidden="true" />
            {overdue
                ? `Próxima decisión inminente (${ventanaSegundos}s de ventana).`
                : `Próxima decisión en ${remainingSec.toLocaleString("es-AR")} s.`}
        </p>
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
                            <PrediccionDetalle prediccion={d.prediccion} />
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

// F-F9: panel colapsable que muestra la salida cruda del XGBoost asociada a una
// decisión (3 cabezas: ok, quemados, crudos). Por defecto colapsado porque es
// información de auditoría y la fila ya muestra la nota resumen arriba.
function PrediccionDetalle({ prediccion }: { prediccion: NonNullable<DecisionControl["prediccion"]> }) {
    return (
        <details className="mt-1 group">
            <summary className="cursor-pointer select-none text-[10px] uppercase text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background">
                Predicción XGBoost
                {prediccion.esPlaceholder && (
                    <span className="ml-1 rounded bg-amber-200/60 px-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                        placeholder
                    </span>
                )}
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <HeadValue label="OK" value={prediccion.pctOk} tone="text-success" />
                <HeadValue label="Quemados" value={prediccion.pctQuemados} tone="text-destructive" />
                <HeadValue label="Crudos" value={prediccion.pctCrudos} tone="text-warning" />
            </div>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                modelo: {prediccion.modelVersion || "—"}
            </p>
        </details>
    )
}

function HeadValue({ label, value, tone }: { label: string; value: number; tone: string }) {
    // El backend entrega los porcentajes en 0..100, no en fracción.
    const pct = `${value.toFixed(1)}%`
    return (
        <div className="rounded border bg-muted/40 px-2 py-1">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className={cn("font-mono tabular-nums", tone)}>{pct}</p>
        </div>
    )
}

interface ParametrosControlProps {
    lote: LoteSector
    limites: ControlLimites | null
    onSuccess: () => void
    onError: (msg: string | null) => void
}

function ParametrosControl({ lote, limites, onSuccess, onError }: ParametrosControlProps) {
    const initialTolerancia = limites?.tolerancia_temp_c ?? lote.tolerancia_temp_c ?? 2
    const initialUmbralCrudo = lote.umbral_aceptacion_crudo ?? 5
    const initialUmbralQuemado = lote.umbral_aceptacion_quemado ?? 5
    const initialDeltaTemp = limites?.delta_temp1_max_c ?? lote.delta_temp1_max_c ?? ""
    const initialDeltaVel = limites?.delta_vel_max ?? lote.delta_vel_max ?? ""

    const [tolerancia, setTolerancia] = useState(String(initialTolerancia))
    const [umbralCrudo, setUmbralCrudo] = useState(String(initialUmbralCrudo))
    const [umbralQuemado, setUmbralQuemado] = useState(String(initialUmbralQuemado))
    const [deltaTemp, setDeltaTemp] = useState(initialDeltaTemp === "" ? "" : String(initialDeltaTemp))
    const [deltaVel, setDeltaVel] = useState(initialDeltaVel === "" ? "" : String(initialDeltaVel))
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [pending, startParamsTransition] = useTransition()

    const validate = (): { ok: true; params: import("@/actions/api").ControlParamsInput } | { ok: false; errors: Record<string, string> } => {
        const errors: Record<string, string> = {}

        const t = parseFloat(tolerancia)
        if (!Number.isFinite(t) || !(t > 0 && t <= 20)) {
            errors.tolerancia = "Entre 0,01 y 20 °C."
        }
        const uc = parseFloat(umbralCrudo)
        if (!Number.isFinite(uc) || !(uc >= 0 && uc <= 100)) {
            errors.umbralCrudo = "Entre 0 y 100 %."
        }
        const uq = parseFloat(umbralQuemado)
        if (!Number.isFinite(uq) || !(uq >= 0 && uq <= 100)) {
            errors.umbralQuemado = "Entre 0 y 100 %."
        }

        let dt: number | null = null
        if (deltaTemp.trim() !== "") {
            dt = parseFloat(deltaTemp)
            if (!Number.isFinite(dt) || !(dt > 0 && dt <= 50)) {
                errors.deltaTemp = "Entre 0,01 y 50 °C."
            }
        }
        let dv: number | null = null
        if (deltaVel.trim() !== "") {
            dv = parseFloat(deltaVel)
            if (!Number.isFinite(dv) || !(dv > 0 && dv <= 2)) {
                errors.deltaVel = "Entre 0,01 y 2 m/s."
            }
        }

        if (Object.keys(errors).length > 0) {
            return { ok: false, errors }
        }

        const params: import("@/actions/api").ControlParamsInput = {}
        if (t !== initialTolerancia) params.tolerancia_temp_c = t
        if (uc !== initialUmbralCrudo) params.umbral_aceptacion_crudo = uc
        if (uq !== initialUmbralQuemado) params.umbral_aceptacion_quemado = uq
        const initialDtNum = typeof initialDeltaTemp === "number" ? initialDeltaTemp : null
        if (dt !== initialDtNum) params.delta_temp1_max_c = dt
        const initialDvNum = typeof initialDeltaVel === "number" ? initialDeltaVel : null
        if (dv !== initialDvNum) params.delta_vel_max = dv

        return { ok: true, params }
    }

    const handleSubmit = () => {
        onError(null)
        const result = validate()
        if (!result.ok) {
            setFieldErrors(result.errors)
            return
        }
        setFieldErrors({})
        if (Object.keys(result.params).length === 0) return

        startParamsTransition(async () => {
            try {
                const res = await updateControlParams(lote.id, result.params)
                if (!res.ok) {
                    onError(res.errors.join(" · "))
                    return
                }
                onSuccess()
            } catch (e) {
                onError(e instanceof Error ? e.message : "Error al actualizar los parámetros.")
            }
        })
    }

    return (
        <section aria-label="Parámetros del control" className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Parámetros del control</h4>
                <span className="text-[10px] text-muted-foreground">Vacío = valor del producto</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                <ParametroField
                    label="Tolerancia T"
                    unit="°C"
                    value={tolerancia}
                    onChange={setTolerancia}
                    error={fieldErrors.tolerancia}
                    disabled={pending}
                />
                <ParametroField
                    label="Umbral crudo"
                    unit="%"
                    value={umbralCrudo}
                    onChange={setUmbralCrudo}
                    error={fieldErrors.umbralCrudo}
                    disabled={pending}
                />
                <ParametroField
                    label="Umbral quemado"
                    unit="%"
                    value={umbralQuemado}
                    onChange={setUmbralQuemado}
                    error={fieldErrors.umbralQuemado}
                    disabled={pending}
                />
                <ParametroField
                    label="ΔT máx/ciclo"
                    unit="°C"
                    value={deltaTemp}
                    onChange={setDeltaTemp}
                    error={fieldErrors.deltaTemp}
                    disabled={pending}
                    placeholder="Producto"
                />
                <ParametroField
                    label="ΔV máx/ciclo"
                    unit="m/s"
                    value={deltaVel}
                    onChange={setDeltaVel}
                    error={fieldErrors.deltaVel}
                    disabled={pending}
                    placeholder="Producto"
                />
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={pending}>
                {pending ? "Guardando…" : "Guardar parámetros"}
            </Button>
        </section>
    )
}

function ParametroField({
    label,
    unit,
    value,
    onChange,
    error,
    disabled,
    placeholder,
}: {
    label: string
    unit: string
    value: string
    onChange: (value: string) => void
    error?: string
    disabled?: boolean
    placeholder?: string
}) {
    const id = `${label}-${unit}`.replace(/[^a-zA-Z0-9]/g, "-")
    return (
        <div className="space-y-1">
            <Label htmlFor={id} className="text-[10px] uppercase text-muted-foreground">
                {label} <span className="font-normal normal-case">({unit})</span>
            </Label>
            <Input
                id={id}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                aria-invalid={error ? "true" : "false"}
                className="h-7 text-sm font-mono"
            />
            {error ? (
                <p className="text-[10px] text-destructive" role="alert">{error}</p>
            ) : (
                <p className="text-[10px] text-transparent" aria-hidden="true">.</p>
            )}
        </div>
    )
}