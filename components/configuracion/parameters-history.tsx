"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { TurnoBadge } from "@/components/lotes/turno-badge"
import { OvenTemp } from "@/components/shared/oven-temp"
import { PageButton } from "@/components/shared/page-button"
import { pageCount } from "@/components/shared/pagination-state"
import type { LoteProductivo } from "@/lib/parametros-producto"
import { CONVEYOR_SPEED_UNIT } from "@/lib/production-data"

const PAGE_SIZE_OPTIONS = [10, 20]

interface ParametersHistoryProps {
  lotes: LoteProductivo[]
  productoNombre: string
  error?: string | null
  productoId?: string | null
  total?: number
  page?: number
  pageSize?: number
}

// Per-product batch-run history showing only horno and cinta parameters.
export function ParametersHistory({ lotes, productoNombre, error, productoId, total = lotes.length, page = 1, pageSize = 10 }: ParametersHistoryProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const totalPages = pageCount(total, pageSize)
  const go = (nextPage: number, nextSize = pageSize) => {
    if (!productoId) return
    startTransition(() => router.push(`/configuracion?productoId=${encodeURIComponent(productoId)}&page=${nextPage}&pageSize=${nextSize}`))
  }

  const rangeStart = total > 0 ? (page - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(page * pageSize, total)

  const data = lotes

  return (
    <section
      aria-busy={pending}
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
          <button type="button" onClick={() => router.refresh()} className="text-xs font-semibold text-primary underline underline-offset-4">Reintentar</button>
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
        <>
        {pending && <p role="status" className="border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground">Actualizando historial…</p>}
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
                        <span className="ml-1 text-xs text-muted-foreground">{CONVEYOR_SPEED_UNIT}</span>
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
        </>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> de{" "}
            <span className="font-medium text-foreground">{formatNumber(total)}</span> corridas
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="historial-page-size">Filas</label>
            <select id="historial-page-size" value={pageSize} disabled={pending} onChange={(e) => go(1, Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <PageButton onClick={() => go(1)} disabled={page === 1 || pending} aria-label="Primera página"><ChevronsLeft className="size-4" aria-hidden="true" /></PageButton>
            <PageButton
              onClick={() => go(Math.max(1, page - 1))}
              disabled={page === 1 || pending}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Anterior
            </PageButton>
            <span className="px-2 text-xs font-medium text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <PageButton
              onClick={() => go(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || pending}
            >
              Siguiente
              <ChevronRight className="size-4" aria-hidden="true" />
            </PageButton>
            <PageButton onClick={() => go(totalPages)} disabled={page === totalPages || pending} aria-label="Última página"><ChevronsRight className="size-4" aria-hidden="true" /></PageButton>
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
