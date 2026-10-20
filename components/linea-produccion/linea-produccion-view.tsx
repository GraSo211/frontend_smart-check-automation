"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Factory, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatBucket, formatDate, formatNumber, formatTemp, qualityRate } from "@/lib/format"
import { SectorSelect } from "@/components/shared/sector-select"
import { ControlCard } from "@/components/lotes/control-card"
import type { Alerta, LoteSector, Producto, Sector } from "@/lib/production-data"

interface LineaProduccionViewProps {
    sectores: Sector[]
    selectedSectorId: string | null
    loteAbierto: LoteSector | null
    producto: Producto | null
    alertas: Alerta[]
    /** Habilita el cambio de modo y el start/stop del loop (Supervisor/Admin). */
    canControl: boolean
}

/**
 * Vista de control de la línea: selector de sector, tarjeta de control del lote
 * abierto (modo MANUAL / SUPERVISION / AUTOMATICO, propuesta pendiente,
 * decisiones y ventanas), KPIs de calidad, semáforo de setpoints y alertas.
 *
 * La telemetría del hardware (CPU/RAM/SoC) no se muestra acá: ya está en
 * /dispositivos. El selector de sector navega vía `?sector_id=...` para que el
 * server resuelva lote, producto y alertas por params.
 */
export function LineaProduccionView({
    sectores,
    selectedSectorId,
    loteAbierto,
    producto,
    alertas,
    canControl,
}: LineaProduccionViewProps) {
    const router = useRouter()
    // Estado controlado por la interacción del usuario. La URL manda vía
    // router.push; en revalidaciones externas el contenedor se remonta por
    // el `key` que pone la página server-side.
    const [sectorId, setSectorId] = useState(selectedSectorId ?? "")

    const onSectorChange = (id: string) => {
        setSectorId(id)
        const target = id ? `/linea-produccion?sector_id=${encodeURIComponent(id)}` : "/linea-produccion"
        router.push(target)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-80">
                    <SectorSelect
                        id="linea-produccion-sector"
                        label="Sector"
                        value={sectorId}
                        onChange={onSectorChange}
                        sectores={sectores}
                    />
                </div>
                <p className="text-xs text-muted-foreground">
                    El modo se aplica al lote abierto de este sector. La telemetría
                    del dispositivo se consulta en Dispositivos.
                </p>
            </div>

            {!loteAbierto ? (
                <EmptyState
                    message="Este sector no tiene un lote abierto."
                    hint="El modo de operación se configura sobre un lote abierto. Esperá a que la ENTRADA_HORNO detecte el producto o abrí el lote desde Lotes."
                />
            ) : (
                <div className="grid min-w-0 gap-6 xl:grid-cols-[1.45fr_1fr]">
                    <div className="min-w-0 space-y-6">
                        <ControlCard lote={loteAbierto} canControl={canControl} />
                        <LoteKpis lote={loteAbierto} />
                    </div>
                    <aside className="min-w-0 space-y-4">
                        <SemaforoTolerancia lote={loteAbierto} producto={producto} />
                        <ProductoRangos producto={producto} />
                        <AlertasActivas alertas={alertas} />
                    </aside>
                </div>
            )}
        </div>
    )
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
    return (
        <section
            role="status"
            aria-label="Sin lote abierto"
            className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-sm text-muted-foreground"
        >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
                <Factory className="size-5" aria-hidden="true" />
            </span>
            <div>
                <p className="font-semibold text-foreground">{message}</p>
                {hint ? <p className="mt-1 text-xs">{hint}</p> : null}
            </div>
        </section>
    )
}

/** KPIs del lote abierto: conteos, calidad e inactividad. */
function LoteKpis({ lote }: { lote: LoteSector }) {
    const { ok, crudo, quemado, total } = lote.conteos
    const calidad = qualityRate(ok, total)
    const inactividad = formatNumber(Math.max(0, Math.round(lote.inactividad_segundos)))

    return (
        <section
            aria-label="Indicadores del lote"
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold">Lote en curso</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {lote.producto_nombre} · abierto {formatDate(lote.abierto_en)}
                    </p>
                </div>
                <Link
                    href="/lotes"
                    className="text-xs font-medium text-primary hover:underline"
                >
                    Ver historial
                </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Total" value={formatBucket(total)} />
                <Kpi label="OK" value={formatBucket(ok)} tone="text-success" />
                <Kpi label="Crudos" value={formatBucket(crudo)} tone="text-warning" />
                <Kpi label="Quemados" value={formatBucket(quemado)} tone="text-destructive" />
                <Kpi label="Calidad" value={`${calidad.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`} />
                <Kpi label="Inactividad" value={`${inactividad} s`} />
            </dl>
        </section>
    )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-md border bg-muted/30 px-2 py-1.5">
            <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
            <dd className={cn("font-mono tabular-nums", tone)}>{value}</dd>
        </div>
    )
}

function AlertasActivas({ alertas }: { alertas: Alerta[] }) {
    return (
        <section
            aria-label="Alertas activas del sector"
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
            <header className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                    <TriangleAlert className="size-5" aria-hidden="true" />
                </span>
                <div>
                    <h3 className="text-sm font-semibold">Alertas activas</h3>
                    <p className="text-xs text-muted-foreground">
                        {alertas.length === 0
                            ? "Sin alertas activas en este sector."
                            : `${alertas.length} sin reconocer.`}
                    </p>
                </div>
            </header>
            {alertas.length > 0 ? (
                <ul className="mt-4 space-y-2 text-xs">
                    {alertas.map((alerta) => (
                        <li
                            key={alerta.id}
                            className="rounded-md border bg-muted/30 px-2 py-1.5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span
                                    className={cn(
                                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                        tonoAlerta(alerta.severidad),
                                    )}
                                >
                                    {alerta.severidad}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {formatDate(alerta.created_at)}
                                </span>
                            </div>
                            <p className="mt-1 text-foreground">{alerta.mensaje}</p>
                        </li>
                    ))}
                </ul>
            ) : null}
            {alertas.length > 0 ? (
                <Link
                    href="/alertas"
                    className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                >
                    Gestionar alertas
                </Link>
            ) : null}
        </section>
    )
}

function tonoAlerta(severidad: Alerta["severidad"]): string {
    if (severidad === "CRITICAL") return "bg-destructive/15 text-destructive"
    if (severidad === "WARNING") return "bg-warning/15 text-warning"
    return "bg-muted text-muted-foreground"
}

/**
 * Semáforo de tolerancia: compara el setpoint actual del lote abierto contra
 * los rangos del producto configurado. Verde = dentro del rango, ámbar = a
 * una tolerancia del borde, rojo = fuera de rango. Sin setpoint o sin
 * producto, el panel se degrada con un mensaje neutro.
 */
function SemaforoTolerancia({
    lote,
    producto,
}: {
    lote: LoteSector | null
    producto: Producto | null
}) {
    if (!lote) {
        return (
            <Panel
                titulo="Semáforo de tolerancia"
                icon={<SemaforoIcono nivel="unknown" />}
                nota="No hay lote abierto en este sector."
            />
        )
    }
    if (!producto) {
        return (
            <Panel
                titulo="Semáforo de tolerancia"
                icon={<SemaforoIcono nivel="unknown" />}
                nota="Producto del lote sin catálogo; no se pueden validar rangos."
            />
        )
    }

    const t1 = lote.temp1_objetivo
    const t2 = lote.temp2_objetivo
    const v = lote.vel_objetivo

    const niveles: Array<{ label: string; value: number | null | undefined; range: [number, number] }> = []
    if (typeof t1 === "number") {
        niveles.push({ label: "T1 objetivo", value: t1, range: [producto.tempMin, producto.tempMax] })
    }
    if (typeof t2 === "number") {
        niveles.push({ label: "T2 objetivo", value: t2, range: [producto.tempMin, producto.tempMax] })
    }
    if (typeof v === "number") {
        niveles.push({
            label: "Cinta objetivo",
            value: v,
            range: [producto.velocidadCintaMin, producto.velocidadCintaMax],
        })
    }

    if (niveles.length === 0) {
        return (
            <Panel
                titulo="Semáforo de tolerancia"
                icon={<SemaforoIcono nivel="unknown" />}
                nota="El lote no expone setpoints actuales."
            />
        )
    }

    const peor = niveles.reduce<SemaforoNivel>(
        (acc, n) => {
            const k = classifyRange(n.value, n.range)
            return rank(k) > rank(acc) ? k : acc
        },
        "normal",
    )

    return (
        <Panel
            titulo="Semáforo de tolerancia"
            icon={<SemaforoIcono nivel={peor} />}
            nota="Tolerancias = colores del setpoint del lote vs rango del catálogo."
        >
            <ul className="space-y-2 text-xs">
                {niveles.map((n) => {
                    const nivel = classifyRange(n.value, n.range)
                    const min = n.range[0]
                    const max = n.range[1]
                    return (
                        <li
                            key={n.label}
                            className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-2 py-1.5"
                        >
                            <span className="text-foreground">{n.label}</span>
                            <span className="flex items-center gap-2">
                                <span className="font-mono tabular-nums">
                                    {n.label.startsWith("Cinta")
                                        ? `${n.value?.toLocaleString("es-AR", {
                                              maximumFractionDigits: 2,
                                          })} m/s`
                                        : formatTemp(n.value ?? 0)}
                                </span>
                                <span
                                    className={cn(
                                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                        toneClasses(nivel),
                                    )}
                                    aria-label={`Tolerancia ${labelNivel(nivel)}`}
                                >
                                    {labelNivel(nivel)}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {min}
                                    {n.label.startsWith("Cinta") ? "–" : "–"}
                                    {max}
                                    {n.label.startsWith("Cinta") ? " m/s" : " °C"}
                                </span>
                            </span>
                        </li>
                    )
                })}
            </ul>
        </Panel>
    )
}

function ProductoRangos({ producto }: { producto: Producto | null }) {
    if (!producto) return null
    const fmt = (n: number) => formatNumber(n)
    return (
        <section
            aria-label="Rangos del producto"
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
            <h3 className="text-sm font-semibold">Rangos del producto</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
                {producto.nombre}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                    <dt className="text-[10px] uppercase text-muted-foreground">
                        Temperatura
                    </dt>
                    <dd className="font-mono tabular-nums">
                        {fmt(producto.tempMin)} – {fmt(producto.tempMax)} °C
                    </dd>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                    <dt className="text-[10px] uppercase text-muted-foreground">
                        Velocidad cinta
                    </dt>
                    <dd className="font-mono tabular-nums">
                        {fmt(producto.velocidadCintaMin)} – {fmt(producto.velocidadCintaMax)} m/s
                    </dd>
                </div>
            </dl>
        </section>
    )
}

function Panel({
    titulo,
    icon,
    nota,
    children,
}: {
    titulo: string
    icon: React.ReactNode
    nota?: string
    children?: React.ReactNode
}) {
    return (
        <section
            aria-label={titulo}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
            <header className="flex items-center gap-3">
                {icon}
                <div>
                    <h3 className="text-sm font-semibold">{titulo}</h3>
                    {nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}
                </div>
            </header>
            {children ? <div className="mt-4">{children}</div> : null}
        </section>
    )
}

type SemaforoNivel = "normal" | "warning" | "critical" | "unknown"

function rank(n: SemaforoNivel): number {
    if (n === "critical") return 3
    if (n === "warning") return 2
    if (n === "normal") return 1
    return 0
}

function labelNivel(n: SemaforoNivel): string {
    if (n === "critical") return "Fuera de rango"
    if (n === "warning") return "En el borde"
    if (n === "normal") return "En rango"
    return "Sin datos"
}

function toneClasses(n: SemaforoNivel): string {
    if (n === "critical") return "bg-destructive/15 text-destructive"
    if (n === "warning") return "bg-warning/15 text-warning"
    if (n === "normal") return "bg-success/15 text-success"
    return "bg-muted text-muted-foreground"
}

// Margen de "advertencia": 5% del rango a partir del borde. Antes de ese borde
// es "en el borde" (warning); más allá es "fuera de rango" (critical).
function classifyRange(value: number | null | undefined, range: [number, number]): SemaforoNivel {
    if (value === null || value === undefined || !Number.isFinite(value)) return "unknown"
    const [min, max] = range
    if (value < min || value > max) return "critical"
    const span = max - min
    const margin = span * 0.05
    if (value < min + margin || value > max - margin) return "warning"
    return "normal"
}

function SemaforoIcono({ nivel }: { nivel: SemaforoNivel }) {
    const tone = toneClasses(nivel).split(" ").find((c) => c.startsWith("bg-")) ?? "bg-muted"
    return (
        <span
            aria-hidden="true"
            className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                tone,
            )}
        >
            <span
                className={cn(
                    "size-3 rounded-full",
                    nivel === "normal" && "bg-success",
                    nivel === "warning" && "bg-warning",
                    nivel === "critical" && "bg-destructive",
                    nivel === "unknown" && "bg-muted-foreground/40",
                )}
            />
        </span>
    )
}
