"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Thermometer } from "lucide-react"
import { cn } from "@/lib/utils"
import { TurnoBadge } from "@/components/turno-badge"
import { getProductionPage } from "@/lib/production-data"
import { formatNumber, formatWindow, qualityRate } from "@/lib/format"

const PAGE_SIZE = 10
// Burnt-unit ratio above which a row is flagged as a potential line failure.
const BURNT_WARNING_RATIO = 0.05

// Main supervision data table with client-side pagination over the simulated API.
export function SupervisionTable() {
  const [page, setPage] = useState(1)

  const { data, total, pageSize } = useMemo(
    () => getProductionPage(page, PAGE_SIZE),
    [page],
  )

  const totalPages = Math.ceil(total / pageSize)
  const rangeStart = (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <section
      aria-label="Tabla de supervisión de producción"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Lotes de Producción</h2>
          <p className="text-xs text-muted-foreground">
            Supervisión en tiempo real por turno
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {formatNumber(total)} registros totales
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left">
              <Th>Producto</Th>
              <Th>Turno</Th>
              <Th>Franja horaria</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Calidad</Th>
              <Th className="text-right">Quemados</Th>
              <Th className="text-center">Temperaturas de horno</Th>
              <Th className="text-right">Velocidad</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((run) => {
              const burntRatio = run.quemados / run.totalUnidades
              const isWarning = burntRatio >= BURNT_WARNING_RATIO
              const quality = qualityRate(run.correctos, run.totalUnidades)

              return (
                <tr
                  key={run.id}
                  className={cn(
                    "border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40",
                    isWarning && "bg-red-50/40",
                  )}
                >
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-foreground">
                      {run.productoNombre}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <TurnoBadge turno={run.turno} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                    {formatWindow(run.inicioAt, run.finAt)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                    {formatNumber(run.totalUnidades)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="font-mono tabular-nums text-emerald-700">
                      {formatNumber(run.correctos)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {quality.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono tabular-nums",
                        isWarning ? "font-semibold text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {isWarning && (
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                      )}
                      {formatNumber(run.quemados)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-3 text-xs">
                      <OvenTemp label="H1" temp={run.temp_horno_1} />
                      <OvenTemp label="H2" temp={run.temp_horno_2} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                    {run.velocidad_horno}
                    <span className="ml-1 text-xs text-muted-foreground">u/min</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{rangeStart}</span>–
          <span className="font-medium text-foreground">{rangeEnd}</span> de{" "}
          <span className="font-medium text-foreground">{formatNumber(total)}</span> elementos
        </p>
        <div className="flex items-center gap-2">
          <PageButton
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Anterior
          </PageButton>
          <span className="px-2 text-xs font-medium text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <PageButton
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
            <ChevronRight className="size-4" aria-hidden="true" />
          </PageButton>
        </div>
      </div>
    </section>
  )
}

// Styled table header cell.
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  )
}

// Compact oven temperature pill with color coded high-heat states.
function OvenTemp({ label, temp }: { label: string; temp: number }) {
  const hot = temp >= 225
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
      {temp}°
    </span>
  )
}

// Pagination button with disabled styling.
function PageButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card"
    >
      {children}
    </button>
  )
}
