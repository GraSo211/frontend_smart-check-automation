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
import SegmentedControl from "@/components/supervision/segmented-control"
import { cn } from "@/lib/utils"
import { formatDate, formatTime, formatTemp } from "@/lib/format"
import type { ConfianzaClase, DecisionControl, LoteSector, SetpointPropuesto } from "@/lib/production-data"
import {
    aplicarConsigna,
    cambiarModo,
    getConfianzaClases,
    getConsignaPropuesta,
    getDecisiones,
    startControl,
    stopControl,
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
    const horno2 = lote.horno2_habilitado ?? false

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
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const [modalOpen, setModalOpen] = useState(false)
    const [propuesta, setPropuesta] = useState<SetpointPropuesto | null>(null)
    const [loadingPropuesta, setLoadingPropuesta] = useState(false)
    const [aplicarError, setAplicarError] = useState<string | null>(null)

    const [propuestaPendiente, setPropuestaPendiente] = useState<SetpointPropuesto | null>(null)
    const [sseConnected, setSseConnected] = useState(false)

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

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                const payload = JSON.parse((ev as MessageEvent).data) as { propuesta?: SetpointPropuesto }
                if (payload.propuesta) {
                    setPropuestaPendiente(payload.propuesta)
                }
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
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h3 className="font-semibold">Control del lote</h3>
                    <p className="text-xs text-muted-foreground">
                        Modo:{" "}
                        <span className="font-mono" aria-live="polite">
                            {modoActual}
                        </span>
                        {horno2 && " · Horno 2 habilitado"}
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
                                startTransition(async () => {
                                    await startControl(lote.id)
                                    refresh()
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
                                startTransition(async () => {
                                    await stopControl(lote.id)
                                    refresh()
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

                    {modoActual === "SUPERVISION" && (
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
    const pct = `${(value * 100).toFixed(1)}%`
    return (
        <div className="rounded border bg-muted/40 px-2 py-1">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className={cn("font-mono tabular-nums", tone)}>{pct}</p>
        </div>
    )
}