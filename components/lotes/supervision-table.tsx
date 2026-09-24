"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageButton } from "@/components/shared/page-button"
import { clampPage, pageCount } from "@/components/shared/pagination-state"
import { formatBucket, formatDate, formatNumber, formatTime, formatWindow, qualityRate } from "@/lib/format"
import type { LoteSector, Sector } from "@/lib/production-data"

const PAGE_SIZE = 10
// Burnt-unit ratio above which a row is flagged as a potential line failure.
const BURNT_WARNING_RATIO = 0.05

interface SupervisionTableProps {
  runs: LoteSector[]
  /** Optional catalog to resolve `sector_id` into a human name. */
  sectores?: Sector[]
}

function EstadoBadge({ estado }: { estado: LoteSector["estado"] }) {
  const abierto = estado === "ABIERTO"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        abierto
          ? "bg-success/10 text-success ring-success/25"
          : "bg-secondary text-muted-foreground ring-border",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", abierto ? "bg-success" : "bg-muted-foreground/60")}
        aria-hidden="true"
      />
      {abierto ? "Abierto" : "Cerrado"}
    </span>
  )
}

// Main supervision data table with client-side pagination.
export function SupervisionTable({ runs, sectores = [] }: SupervisionTableProps) {
  const [page, setPage] = useState(1)

  const total = runs.length
  const totalPages = pageCount(total, PAGE_SIZE)
  const [previousTotal, setPreviousTotal] = useState(total)
  if (previousTotal !== total) {
    setPreviousTotal(total)
    const nextPage = clampPage(page, totalPages)
    if (nextPage !== page) setPage(nextPage)
  }

  const rangeStart = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const data = useMemo(
    () => runs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [runs, page],
  )

  const sectorNames = useMemo(
    () => new Map(sectores.map((sector) => [sector.id, sector.nombre])),
    [sectores],
  )

  return (
    <section
      aria-label="Tabla de supervisión de producción"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      {/*TITULO TABLA*/}
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Lotes de Producción</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Supervisión en tiempo real por sector y estado
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          {formatNumber(total)} registros totales
        </span>
      </div>

      {/*TABLA*/}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sin lotes para mostrar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No hay lotes registrados o no coinciden con los filtros seleccionados.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-300 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left">
                <Th>Producto</Th>
                <Th>Sector</Th>
                <Th className="text-center">Estado</Th>
                <Th className="text-center">Turno</Th>
                <Th className="text-center">Franja horaria</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Correctos</Th>
                <Th className="text-right">Quemados</Th>
                <Th className="text-right">Crudas</Th>
                <Th className="text-center">Temperaturas de horno</Th>
                <Th className="text-right">Vel. cinta</Th>
              </tr>
            </thead>

            <tbody>
              {data.map((lote) => {
                const { conteos } = lote
                const totalUnidades = conteos.total
                const burntRatio = totalUnidades > 0 ? (conteos.quemado ?? 0) / totalUnidades : 0
                const isWarning =
                  totalUnidades > 0 && conteos.quemado !== null && burntRatio >= BURNT_WARNING_RATIO
                const quality = qualityRate(conteos.ok ?? 0, totalUnidades)
                const sectorNombre = sectorNames.get(lote.sector_id)

                return (
                  <tr
                    key={lote.id}
                    className={cn(
                      "border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40",
                      isWarning && "bg-destructive/5 hover:bg-destructive/10",
                    )}
                  >
                    {/* //? PRODUCTO */}
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-foreground">{lote.producto_nombre}</span>
                    </td>

                    {/* //? SECTOR */}
                    <td className="px-4 py-3.5">
                      <div className="text-foreground">{sectorNombre ?? lote.sector_id}</div>
                      {sectorNombre && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {lote.sector_id}
                        </div>
                      )}
                    </td>

                    {/* //? ESTADO */}
                    <td className="px-4 py-3.5 text-center">
                      <EstadoBadge estado={lote.estado} />
                    </td>

                    {/* //? TURNO — calculado por el backend; puede faltar en lotes legacy. */}
                    <td className="px-4 py-3.5 text-center font-mono text-muted-foreground">
                      {lote.turno ?? "—"}
                    </td>

                    {/* //? FRANJA HORARIA */}
                    <td className="px-4 py-3.5 text-center font-mono text-xs text-muted-foreground">
                      {lote.cerrado_en ? (
                        formatWindow(lote.abierto_en, lote.cerrado_en)
                      ) : (
                        <span>
                          {formatDate(lote.abierto_en)} · {formatTime(lote.abierto_en)}–
                          <span className="ml-1 font-sans font-medium text-success">en curso</span>
                        </span>
                      )}
                    </td>

                    {/* //? TOTAL */}
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                      {formatBucket(conteos.total)}
                    </td>

                    {/* //? CORRECTOS */}
                    <td className="px-4 py-3.5 text-center">
                      <div
                        className={cn(
                          "font-mono tabular-nums",
                          conteos.ok === null ? "text-muted-foreground" : "text-success",
                        )}
                      >
                        {formatBucket(conteos.ok)}
                      </div>
                      {conteos.ok !== null && totalUnidades > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {quality.toFixed(1)}%
                        </div>
                      )}
                    </td>

                    {/* //? QUEMADOS */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono tabular-nums",
                          isWarning
                            ? "font-semibold text-destructive"
                            : conteos.quemado === null
                              ? "text-muted-foreground"
                              : "text-foreground",
                        )}
                      >
                        {isWarning && (
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                        )}
                        {formatBucket(conteos.quemado)}
                      </span>
                    </td>

                    {/* //? CRUDAS */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono tabular-nums",
                          conteos.crudo === null ? "text-muted-foreground" : "text-warning",
                        )}
                      >
                        {formatBucket(conteos.crudo)}
                      </span>
                    </td>

                    {/* //? TEMPERATURAS — fuera del contrato, se mantiene el lugar. */}
                    <td className="px-4 py-3.5 text-center font-mono text-muted-foreground">
                      —
                    </td>

                    {/* //? VELOCIDAD DE CINTA — fuera del contrato. */}
                    <td className="px-4 py-3.5 text-center font-mono text-muted-foreground">
                      —
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
