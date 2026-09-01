"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Database,
  Eye,
  Factory,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react"
import { setLastSync } from "@/lib/sync-store"
import { formatKg, formatNumber, qualityRate } from "@/lib/format"
import type { UserRole } from "@/lib/auth"
import type { ProductionRun } from "@/lib/production-data"

interface DashboardContentProps {
  runs: ProductionRun[]
  lastSyncAt: string | null
  userRole?: UserRole
  error?: string | null
}

const sections: Array<{
  href: string
  label: string
  description: string
  icon: LucideIcon
  tone: string
  metric: string
}> = [
  { href: "/supervision", label: "Supervisión en vivo", description: "Cámaras y señales de la línea en tiempo real.", icon: Eye, tone: "bg-info/10 text-info", metric: "Monitoreo activo" },
  { href: "/lotes", label: "Lotes y datos", description: "Consultá resultados y rendimiento cuando necesites profundizar.", icon: Database, tone: "bg-primary/10 text-primary", metric: "Datos disponibles" },
  { href: "/nodos", label: "Estado de los nodos", description: "Salud de los dispositivos conectados a la planta.", icon: Cpu, tone: "bg-success/10 text-success", metric: "Telemetría IoT" },
  { href: "/configuracion", label: "Configuración", description: "Parámetros de producto y reglas operativas.", icon: Settings2, tone: "bg-warning/10 text-warning", metric: "Parámetros de línea" },
  { href: "/alertas", label: "Manejo de alertas", description: "Priorizá desvíos y mantené el equipo al tanto.", icon: BellRing, tone: "bg-destructive/10 text-destructive", metric: "Centro de atención" },
  { href: "/usuarios", label: "Usuarios y roles", description: "Accesos, permisos y responsables del sistema.", icon: Users, tone: "bg-accent/10 text-accent", metric: "Gestión de equipo" },
]

// Proyección interna, no contable: se aplica sólo sobre la merma observada en runs.
// Los supuestos son deliberadamente conservadores y se mantienen visibles en el microcopy.
const ESTIMATION = {
  avoidableWasteRate: 0.15,
  replacementCostPerUnit: 85,
} as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

export function DashboardContent({ runs, lastSyncAt, userRole = "Operario", error }: DashboardContentProps) {
  useEffect(() => { if (lastSyncAt) setLastSync(lastSyncAt) }, [lastSyncAt])

  const metrics = useMemo(() => {
    const units = runs.reduce((sum, run) => sum + run.totalUnidades, 0)
    const correctos = runs.reduce((sum, run) => sum + run.correctos, 0)
    const kg = runs.reduce((sum, run) => sum + run.correctosKg + run.quemadosKg + (run.crudosKg ?? 0), 0)
    const temperature = runs.length ? runs.reduce((sum, run) => sum + (run.tempHorno1 + run.tempHorno2) / 2, 0) / runs.length : 0
    const alerts = runs.filter((run) => run.quemados / run.totalUnidades >= 0.05).length
    const wasteUnits = runs.reduce((sum, run) => sum + run.quemados + (run.crudas ?? 0), 0)
    const opportunityUnits = Math.round(wasteUnits * ESTIMATION.avoidableWasteRate)
    return { units, kg, temperature, alerts, wasteUnits, opportunityUnits, projectedSavings: opportunityUnits * ESTIMATION.replacementCostPerUnit, quality: qualityRate(correctos, units) }
  }, [runs])

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary"><Factory className="size-4" aria-hidden="true" /> Centro de operaciones</p>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Buen día, equipo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Todo lo importante de Smart-Check Automation, en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-success" /> Planta conectada · {userRole}</div>
      </header>

      {error && <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm shadow-sm" role="status"><CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" /><p><span className="font-medium">Datos de producción de respaldo.</span> El resto del panel continúa disponible.</p></div>}

      <section className="grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="relative overflow-hidden rounded-xl bg-primary px-5 py-6 text-primary-foreground shadow-sm sm:p-8">
          <div className="absolute -right-20 -top-24 size-72 rounded-full border border-primary-foreground/10" />
          <div className="relative"><p className="text-xs font-medium uppercase tracking-widest text-primary-foreground/60">Pulso de la operación</p><p className="mt-8 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">{formatKg(metrics.kg)}</p><p className="mt-2 text-sm text-primary-foreground/70">producción registrada</p><div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-primary-foreground/75"><span><strong className="text-primary-foreground">{formatNumber(metrics.units)}</strong> unidades</span><span><strong className="text-primary-foreground">{runs.length}</strong> lotes monitoreados</span></div><Link href="/supervision" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary-foreground/90">Abrir supervisión <ArrowUpRight className="size-4" /></Link></div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm"><div><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Calidad de línea</p><CheckCircle2 className="size-5 text-success" /></div><p className="mt-8 font-mono text-4xl font-semibold tracking-tight text-foreground">{metrics.quality.toFixed(1)}%</p><p className="mt-2 text-sm text-muted-foreground">unidades correctas</p></div><div className="mt-8 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${metrics.quality}%` }} /></div></div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores operativos">
        <Metric label="Temperatura promedio" value={`${Math.round(metrics.temperature)}°C`} hint="Hornos 1 y 2" />
        <Metric label="Alertas para revisar" value={String(metrics.alerts)} hint={metrics.alerts ? "Requieren atención" : "Sin desvíos críticos"} emphasis={metrics.alerts > 0} />
        <Metric label="Conectividad" value="Activa" hint="Servicios operativos" />
        <Metric label="Sincronización" value={lastSyncAt ? "Al día" : "Pendiente"} hint="Última actualización" />
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Indicadores de impacto estimado">
        <ImpactCard eyebrow="Proyección interna" title="Ahorro potencial estimado" value={formatCurrency(metrics.projectedSavings)} detail={`${formatNumber(metrics.opportunityUnits)} unidades recuperables`} note={`Calculado sobre el ${ESTIMATION.avoidableWasteRate * 100}% de la merma observada, a ${formatCurrency(ESTIMATION.replacementCostPerUnit)} por unidad.`} tone="text-success" />
        <ImpactCard eyebrow="Oportunidad de mejora" title="Impacto estimado en merma" value={`${ESTIMATION.avoidableWasteRate * 100}% menos`} detail={`${formatNumber(metrics.opportunityUnits)} de ${formatNumber(metrics.wasteUnits)} unidades de merma`} note="Proyección orientativa sobre quemados y crudas registrados; no representa un resultado garantizado." tone="text-info" />
      </section>

      <section aria-labelledby="modules-heading"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tu espacio de trabajo</p><h2 id="modules-heading" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Accesos y estado</h2></div><span className="hidden text-xs text-muted-foreground sm:block">6 módulos disponibles</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map((section) => <SectionCard key={section.href} {...section} />)}</div></section>
    </div>
  )
}

function Metric({ label, value, hint, emphasis = false }: { label: string; value: string; hint: string; emphasis?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><p className="truncate text-xs text-muted-foreground">{label}</p><p className={`mt-3 font-mono text-xl font-semibold tracking-tight ${emphasis ? "text-destructive" : "text-foreground"}`}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></div>
}

function ImpactCard({ eyebrow, title, value, detail, note, tone }: { eyebrow: string; title: string; value: string; detail: string; note: string; tone: string }) {
  return <article className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p><h2 className="mt-2 text-base font-semibold tracking-tight text-foreground">{title}</h2></div><span className={`mt-1 size-2 shrink-0 rounded-full bg-current ${tone}`} aria-hidden="true" /></div><p className={`mt-6 font-mono text-3xl font-semibold tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-sm font-medium text-foreground">{detail}</p><p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{note}</p></article>
}

function SectionCard({ href, label, description, icon: Icon, tone, metric }: (typeof sections)[number]) {
  return <Link href={href} className="group flex min-h-40 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between"><span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></div><div><p className="text-xs text-muted-foreground">{metric}</p><h3 className="mt-1 text-base font-semibold text-foreground">{label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></Link>
}
