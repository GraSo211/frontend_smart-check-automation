import { Sun, Sunset, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductionRun } from "@/lib/production-data"

// Maps each shift to an icon, label and color treatment.
const TURNO_CONFIG: Record<
  ProductionRun["turno"],
  { label: string; icon: typeof Sun; className: string }
> = {
  mañana: {
    label: "Mañana",
    icon: Sun,
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  tarde: {
    label: "Tarde",
    icon: Sunset,
    className: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  noche: {
    label: "Noche",
    icon: Moon,
    className: "bg-slate-800 text-slate-100 ring-slate-700",
  },
}

// Renders a visual badge representing the production shift (turno).
export function TurnoBadge({ turno }: { turno: ProductionRun["turno"] }) {
  const config = TURNO_CONFIG[turno]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        config.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}
