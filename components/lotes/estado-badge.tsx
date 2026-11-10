import { cn } from "@/lib/utils"
import type { LoteSector } from "@/lib/production-data"

export function EstadoBadge({ estado }: { estado: LoteSector["estado"] }) {
  const abierto = estado === "ABIERTO"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        abierto
          ? "bg-success/10 text-success ring-success/25"
          : "bg-secondary text-muted-foreground ring-border",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          abierto ? "bg-success" : "bg-muted-foreground/60",
        )}
        aria-hidden="true"
      />
      {abierto ? "Abierto" : "Cerrado"}
    </span>
  )
}
