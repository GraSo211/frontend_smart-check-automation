import { Boxes, ShieldCheck, Flame, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber, formatTemp } from "@/lib/format"
import type { LoteSector } from "@/lib/production-data"

interface KpiCardsProps {
  runs: LoteSector[]
}

// F-F3: el backend expone `temp1_objetivo` y `vel_objetivo` por lote.
// Promediamos los valores presentes por card. Una métrica con todas sus
// observaciones ausentes se mantiene como "—" para no publicar un 0 fabricado.
function computeMetrics(runs: LoteSector[]) {
  const totalUnits = runs.reduce((sum, run) => sum + run.conteos.total, 0)
  const totalOk = runs.reduce((sum, run) => sum + (run.conteos.ok ?? 0), 0)
  const totalDefects = runs.reduce(
    (sum, run) => sum + (run.conteos.quemado ?? 0) + (run.conteos.crudo ?? 0),
    0,
  )

  const temp1: number[] = []
  const vel: number[] = []
  for (const run of runs) {
    if (typeof run.temp1_objetivo === "number") temp1.push(run.temp1_objetivo)
    if (typeof run.vel_objetivo === "number") vel.push(run.vel_objetivo)
  }

  const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)

  return {
    totalUnits,
    qualityRate: totalUnits ? (totalOk / totalUnits) * 100 : 0,
    defectRate: totalUnits ? (totalDefects / totalUnits) * 100 : 0,
    avgTemp1: avg(temp1),
    avgVel: avg(vel),
    samplesTemp: temp1.length,
    samplesVel: vel.length,
  }
}

// Renders the responsive grid of summary KPI cards.
export function KpiCards({ runs }: KpiCardsProps) {
  const m = computeMetrics(runs)

  const hasData = runs.length > 0
  const hasUnits = hasData && m.totalUnits > 0
  // A bucket the model never emits stays null: an all-null `ok` (or all-null
  // `quemado`+`crudo`) must render "—" instead of a fabricated 0.0% rate.
  const hasOk = runs.some((run) => run.conteos.ok !== null)
  const hasWaste = runs.some(
    (run) => run.conteos.quemado !== null || run.conteos.crudo !== null,
  )

  const tempObjetivo = m.avgTemp1 !== null ? formatTemp(m.avgTemp1) : null

  const cards = [
    {
      label: "Unidades procesadas",
      value: hasUnits ? formatNumber(m.totalUnits) : "—",
      hint: `${runs.length} lotes de producción`,
      icon: Boxes,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Tasa de calidad general",
      value: hasUnits && hasOk ? `${m.qualityRate.toFixed(1)}%` : "—",
      hint: "Correctos vs unidades totales",
      icon: ShieldCheck,
      accent: "bg-success/10 text-success",
    },
    {
      label: "Tasa de merma",
      value: hasUnits && hasWaste ? `${m.defectRate.toFixed(1)}%` : "—",
      hint: "Quemados y crudos vs total",
      icon: Flame,
      accent: "bg-destructive/10 text-destructive",
    },
    {
      label: "Temperatura objetivo (T1)",
      value: tempObjetivo ?? "—",
      hint:
        m.avgVel !== null
          ? `Cinta objetivo ${m.avgVel.toLocaleString("es-AR", { maximumFractionDigits: 2 })} m/s · ${m.samplesTemp} muestras`
          : `Cinta objetivo — · ${m.samplesTemp} muestras`,
      icon: Gauge,
      accent: "bg-warning/10 text-warning",
    },
  ]

  return (
    <section
      aria-label="Métricas de resumen"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                  {card.value}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  card.accent,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{card.hint}</p>
          </div>
        )
      })}
    </section>
  )
}
