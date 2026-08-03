"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Thermometer, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { TurnoBadge } from "@/components/lotes/turno-badge"
import { formatKg, formatNumber, formatWindow, qualityRate } from "@/lib/format"
import type { ProductionRun } from "@/lib/production-data"

const PAGE_SIZE = 10
// Burnt-unit ratio above which a row is flagged as a potential line failure.
const BURNT_WARNING_RATIO = 0.05

interface SupervisionTableProps {
  runs: ProductionRun[]
}



// Main supervision data table with client-side pagination.
export function SupervisionTable({ runs }: SupervisionTableProps) {
  const [page, setPage] = useState(1)

  const total = runs.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const rangeStart = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const data = useMemo(
    () => runs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [runs, page],
  )

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages)
    }
  }, [totalPages, page])

  return (
    <section
      aria-label="Tabla de supervisión de producción"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >


      {/*TITULO TABLA*/}
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


      {/*TABLA*/}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
          <SearchX className="size-10 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Sin resultados</p>
          <p className="text-xs text-muted-foreground">
            No se encontraron lotes con los filtros seleccionados.
          </p>
        </div>


      ) : (


        <div className="overflow-x-auto">
          <table className="w-full min-w-275 border-collapse text-sm">


            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left">
                <Th>Producto</Th>
                <Th>Turno</Th>
                <Th>Franja horaria</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Correctos</Th>
                <Th className="text-right">Quemados</Th>
                <Th className="text-right">Crudas</Th>
                <Th className="text-center">Temperaturas de horno</Th>
                <Th className="text-right">Vel. cinta</Th>
              </tr>
            </thead>


            <tbody>
              {data.map((run) => {
                const burntRatio = run.quemados / run.totalUnidades
                const isWarning = burntRatio >= BURNT_WARNING_RATIO
                const quality = qualityRate(run.correctos, run.totalUnidades)
                const hasCrudas = run.crudas !== null && run.crudas >= 0

                return (
                  <tr
                    key={run.id}
                    className={cn(
                      "border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40 ",
                      isWarning && "bg-red-500/50",
                    )}
                  >


                    {/* //? NOMBRE */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-medium text-foreground">
                        {run.productoNombre}
                      </span>
                    </td>


                    {/* //? TURNO */}
                    <td className="px-4 py-3.5 text-center">
                      <TurnoBadge turno={run.turno} />
                    </td>


                    {/* //? FRANJA HORARIA */}
                    <td className="px-4 py-3.5 font-mono text-xs text-center text-muted-foreground">
                      {formatWindow(run.inicioAt, run.finAt)}
                    </td>

                    {/* //? TOTAL UNIDADES */}
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                      {formatNumber(run.totalUnidades)}
                    </td>

                    {/* //? CORRECTOS */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="font-mono tabular-nums text-emerald-700">
                        {formatNumber(run.correctos)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatKg(run.correctosKg)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quality.toFixed(1)}%
                      </div>
                    </td>


                    {/* //? QUEMADOS */}
                    <td className="px-4 py-3.5    text-center">
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
                      <div className="text-xs text-muted-foreground">
                        {formatKg(run.quemadosKg)}
                      </div>
                    </td>


                    {/* //? CRUDAS */}
                    <td className="px-4 py-3.5    text-center">
                      <span className="inline-flex items-center gap-1 font-mono  tabular-nums text-amber-700">
                        {hasCrudas ? formatNumber(run.crudas!) : "—"}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {hasCrudas && run.crudosKg ? formatKg(run.crudosKg) : "—"}
                      </div>
                    </td>


                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <OvenTemp label="H1" temp={run.tempHorno1} comb={run.tempCombHorno1} />
                        <OvenTemp label="H2" temp={run.tempHorno2} comb={run.tempCombHorno2} />
                      </div>
                    </td>


                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                      {run.velocidadCinta.toFixed(2)}
                      <span className="ml-1 text-xs text-muted-foreground">m/min</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/*FOOTER DE LA TABLA*/}
      {total > 0 && (
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
      )}
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

// Compact oven temperature pill with color coded high-heat states and combustion temp.
function OvenTemp({ label, temp, comb }: { label: string; temp: number; comb: number }) {
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
      <span className="text-[10px] opacity-50">{comb}°</span>
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
