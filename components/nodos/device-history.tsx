"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatRam, formatTemp, formatTime } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { PageButton } from "@/components/shared/page-button"
import type { SpecificDevice } from "@/lib/devices-data"

const PAGE_SIZE = 10

interface DeviceHistoryProps {
  deviceId: string | null
  deviceName: string | null
  history: SpecificDevice[]
  loading: boolean
  error?: string | null
}

// Renders the selected device's telemetry history as a paginated table.
export function DeviceHistory({ deviceId, deviceName, history, loading, error }: DeviceHistoryProps) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [deviceId])

  const total = history.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const rangeStart = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const data = useMemo(
    () => history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [history, page],
  )

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages)
    }
  }, [totalPages, page])

  return (
    <section
      aria-label="Historial de telemetría del dispositivo"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Historial del dispositivo</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {deviceId
              ? `Telemetría de ${deviceName ?? deviceId}`
              : "Seleccioná un nodo para ver su historial"}
          </p>
        </div>
        {deviceId && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {formatNumber(total)} registros
          </span>
        )}
      </div>

      {!deviceId ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sin selección</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Seleccioná un nodo arriba para ver su historial de telemetría.
            </p>
          </div>
        </div>
      ) : error && history.length === 0 ? (
        <div role="alert" className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">!</span>
          <div><p className="text-sm font-semibold text-foreground">Historial no disponible</p><p className="mt-1 text-xs text-muted-foreground">{error}</p></div>
        </div>
      ) : loading && history.length === 0 ? (
        <div className="space-y-2 px-5 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sin datos de historial</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No se encontraron registros de telemetría para este nodo.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left">
                  <Th>Fecha y hora</Th>
                  <Th className="text-right">CPU</Th>
                  <Th className="text-right">RAM libre</Th>
                  <Th className="text-right">Chip</Th>
                  <Th className="text-right">IA</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr
                    key={row.id || `${row.dispositivoId}-${row.receivedAt}-${index}`}
                    className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs text-foreground">{formatTime(row.receivedAt)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(row.receivedAt)}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                      {row.cpuPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                      {formatRam(row.memRamDisponibleMb)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                      {formatTemp(row.tempChip)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                      {row.aiProcessorPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex min-w-0 flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{rangeStart}</span>–
              <span className="font-medium text-foreground">{rangeEnd}</span> de{" "}
              <span className="font-medium text-foreground">{formatNumber(total)}</span> elementos
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
        </>
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
