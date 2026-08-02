import { Boxes, ShieldCheck, Flame, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatKg, formatNumber } from "@/lib/format"
import type { ProductionRun } from "@/lib/production-data"

interface KpiCardsProps {
  runs: ProductionRun[]
}

// Computes the top-row summary metrics across the full production dataset.
function computeMetrics(runs: ProductionRun[]) {
  const totalKg = runs.reduce(
    (sum, r) => sum + r.correctosKg + r.quemadosKg + (r.crudosKg ?? 0),
    0,
  )
  const totalCorrect = runs.reduce((sum, r) => sum + r.correctos, 0)
  const totalUnits = runs.reduce((sum, r) => sum + r.totalUnidades, 0)
  const totalBurnt = runs.reduce((sum, r) => sum + r.quemados, 0)
  const avgTemp = runs.length
    ? runs.reduce((sum, r) => sum + (r.tempHorno1 + r.tempHorno2) / 2, 0) / runs.length
    : 0
  const avgSpeed = runs.length
    ? runs.reduce((sum, r) => sum + r.velocidadCinta, 0) / runs.length
    : 0

  return {
    totalKg,
    totalUnits,
    qualityRate: totalUnits ? (totalCorrect / totalUnits) * 100 : 0,
    defectRate: totalUnits ? (totalBurnt / totalUnits) * 100 : 0,
    avgTemp,
    avgSpeed,
  }
}

// Renders the responsive grid of summary KPI cards.
export function KpiCards({ runs }: KpiCardsProps) {
  const m = computeMetrics(runs)

  const cards = [
    {
      label: "Unidades procesadas totales en Kg",
      value: formatKg(m.totalKg),
      hint: `${runs.length} lotes de producción`,
      icon: Boxes,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Tasa de calidad general",
      value: `${m.qualityRate.toFixed(1)}%`,
      hint: "Correctos vs unidades totales",
      icon: ShieldCheck,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Tasa de merma",
      value: `${m.defectRate.toFixed(1)}%`,
      hint: "Unidades quemadas / total",
      icon: Flame,
      accent: "bg-red-50 text-red-600",
    },
    {
      label: "Promedio de hornos",
      value: `${Math.round(m.avgTemp)}°C`,
      hint: `Velocidad cinta ${m.avgSpeed.toFixed(1)} m/min`,
      icon: Gauge,
      accent: "bg-amber-50 text-amber-600",
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
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
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
