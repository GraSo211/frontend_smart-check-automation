"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { TurnoBadge } from "@/components/lotes/turno-badge"
import { OvenTemp } from "@/components/shared/oven-temp"
import { PageButton } from "@/components/shared/page-button"
import { clampPage, pageCount } from "@/components/shared/pagination-state"
import type { LoteProductivo } from "@/lib/parametros-producto"

const PAGE_SIZE = 10

interface ParametersHistoryProps {
  lotes: LoteProductivo[]
  productoNombre: string
  error?: string | null
}

// Per-product batch-run history showing only horno and cinta parameters.
export function ParametersHistory({ lotes, productoNombre, error }: ParametersHistoryProps) {
  const [page, setPage] = useState(1)

  const total = lotes.length
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
    () => lotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [lotes, page],
  )

  return (
    <section
      aria-label="Historial de corridas"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Historial de corridas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Parámetros de horno y cinta utilizados en cada corrida de{" "}
            {productoNombre || "este producto"}.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          {error ? "— No disponible" : `${formatNumber(total)} corridas`}
        </span>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="text-sm font-semibold text-destructive">No se pudo cargar el historial</span>
          <p className="max-w-md text-xs text-muted-foreground">{error}</p>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sin corridas registradas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aún no hay corridas para {productoNombre || "este producto"}.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left">
                <Th>Inicio</Th>
                <Th>Turno</Th>
                <Th className="text-center">Horno 1</Th>
                <Th className="text-center">Horno 2</Th>
                <Th className="text-center">Vel. cinta</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((lote) => (
                <tr
                  key={lote.id}
                  className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                    {formatDate(lote.inicioAt)} · {formatTime(lote.inicioAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <TurnoBadge turno={lote.turno} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center">
                      <OvenTemp label="H1" temp={lote.tempHorno1} comb={lote.tempCombHorno1} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center">
                      <OvenTemp label="H2" temp={lote.tempHorno2} comb={lote.tempCombHorno2} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                    {lote.velocidadCinta !== null ? (
                      <>
                        {lote.velocidadCinta.toFixed(2)}
                        <span className="ml-1 text-xs text-muted-foreground">m/s</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> de{" "}
            <span className="font-medium text-foreground">{formatNumber(total)}</span> corridas
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
