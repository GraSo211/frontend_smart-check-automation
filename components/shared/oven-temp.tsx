import { Thermometer } from "lucide-react"
import { cn } from "@/lib/utils"

// Compact oven temperature pill with color coded high-heat states and
// combustion temp. `temp`/`comb` may be null (unmeasured runs).
export function OvenTemp({
  label,
  temp,
  comb,
}: {
  label: string
  temp: number | null
  comb: number | null
}) {
  const hot = temp !== null && temp >= 225
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono tabular-nums ring-1 ring-inset",
        hot
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-secondary text-muted-foreground ring-border",
      )}
    >
      <Thermometer className="size-3" aria-hidden="true" />
      <span className="text-[10px] font-semibold opacity-70">{label}</span>
      {temp !== null ? `${temp}°` : "—"}
      <span className="text-[10px] opacity-50">
        {comb !== null ? `${comb}°` : "—"}
      </span>
    </span>
  )
}
