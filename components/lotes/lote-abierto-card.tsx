import { Boxes, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBucket, formatDate, formatTime } from "@/lib/format"
import type { LoteSector } from "@/lib/production-data"

interface LoteAbiertoCardProps {
  lote: LoteSector | null
  sectorNombre?: string
}

// Server-provided inactivity, rendered as-is (never recomputed from clocks).
function inactividadLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—"
  const value = seconds.toLocaleString("es-AR", { maximumFractionDigits: 1 })
  return `${value} s sin actividad`
}

function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "—"
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

// `abierto_por` absent or opened by anything other than the oven entrance
// means a degraded lote (§12.2).
function degradedDetail(lote: LoteSector): string {
  if (!lote.abierto_por) {
    return "No se registró el dispositivo de apertura. Los conteos pueden ser parciales."
  }
  return `Abierto por la salida del horno (${lote.abierto_por.type}). Los conteos pueden ser parciales.`
}

function EstadoBadge({ estado }: { estado: LoteSector["estado"] }) {
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

// Highlights the currently open lote of a sector with its live conteos and
// flags degraded opens.
export function LoteAbiertoCard({ lote, sectorNombre }: LoteAbiertoCardProps) {
  if (!lote) {
    return (
      <section
        role="status"
        aria-label="Lote abierto"
        className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-6"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
          <Boxes className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Sin lote abierto en este sector
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sectorNombre
              ? `El sector ${sectorNombre} no tiene un lote en curso.`
              : "No hay un lote en curso para mostrar."}
          </p>
        </div>
      </section>
    )
  }

  const degraded = !lote.abierto_por || lote.abierto_por.type !== "ENTRADA_HORNO"
  const conteos = [
    { label: "Total", value: lote.conteos.total, tone: "text-foreground" },
    { label: "Correctos", value: lote.conteos.ok, tone: "text-success" },
    { label: "Quemados", value: lote.conteos.quemado, tone: "text-destructive" },
    { label: "Crudos", value: lote.conteos.crudo, tone: "text-warning" },
  ]

  return (
    <section
      aria-label={`Lote abierto${sectorNombre ? ` en ${sectorNombre}` : ""}`}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div
        className="h-1 w-full bg-gradient-to-r from-primary via-accent to-warning"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {sectorNombre ? `Lote abierto · ${sectorNombre}` : "Lote abierto"}
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {lote.producto_nombre}
          </h2>
        </div>
        <EstadoBadge estado={lote.estado} />
      </div>

      <div className="space-y-4 p-5">
        {degraded && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <p>
              <span className="font-semibold text-warning">Lote degradado: </span>
              {degradedDetail(lote)}
            </p>
          </div>
        )}

        <dl
          role="status"
          aria-label="Conteos del lote"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {conteos.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
            >
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono text-2xl font-bold tabular-nums tracking-tight",
                  item.tone,
                )}
              >
                {formatBucket(item.value)}
              </dd>
            </div>
          ))}
        </dl>

        <dl className="grid gap-x-4 gap-y-3 border-t border-border pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium uppercase tracking-wide text-muted-foreground">
              Abierto
            </dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {timeLabel(lote.abierto_en)}
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide text-muted-foreground">
              Último evento
            </dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {timeLabel(lote.ultimo_evento_en)}
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide text-muted-foreground">
              Inactividad
            </dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {inactividadLabel(lote.inactividad_segundos)}
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide text-muted-foreground">
              Apertura
            </dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {lote.abierto_por?.type ?? "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
