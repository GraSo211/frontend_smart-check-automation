import { Boxes, ShieldCheck, Flame, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LoteSector } from "@/lib/production-data"

interface KpiCardsProps {
  runs: LoteSector[]
}

// Computes the summary metrics available in the sector/lotes contract. Weight,
// oven temperature and conveyor speed no longer travel in the model, so their
// cards keep a literal placeholder instead of a fabricated value.
function computeMetrics(runs: LoteSector[]) {
  const totalUnits = runs.reduce((sum, run) => sum + run.conteos.total, 0)
  const totalOk = runs.reduce((sum, run) => sum + (run.conteos.ok ?? 0), 0)
  const totalDefects = runs.reduce(
    (sum, run) => sum + (run.conteos.quemado ?? 0) + (run.conteos.crudo ?? 0),
    0,
  )

  return {
    totalUnits,
    qualityRate: totalUnits ? (totalOk / totalUnits) * 100 : 0,
    defectRate: totalUnits ? (totalDefects / totalUnits) * 100 : 0,
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
  const cards = [
    {
      label: "Unidades procesadas totales en Kg",
      value: "—",
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
      label: "Promedio de hornos",
      value: "—",
      hint: "Velocidad cinta —",
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
