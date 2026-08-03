"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, History, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatRam, formatTemp, formatTime } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import type { SpecificDevice } from "@/lib/devices-data"

const PAGE_SIZE = 10

interface DeviceHistoryProps {
  deviceId: string | null
  deviceName: string | null
  history: SpecificDevice[]
  loading: boolean
}

// Renders the selected device's telemetry history as a paginated table.
export function DeviceHistory({ deviceId, deviceName, history, loading }: DeviceHistoryProps) {
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
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            Historial del dispositivo
          </h2>
          <p className="text-xs text-muted-foreground">
            {deviceId
              ? `Telemetría de ${deviceName ?? deviceId}`
              : "Seleccioná un nodo para ver su historial"}
          </p>
        </div>
        {deviceId && (
          <span className="font-mono text-[11px] tracking-tight text-muted-foreground">{deviceId}</span>
        )}
      </div>

      {!deviceId ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
          <SearchX className="size-10 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Sin selección</p>
          <p className="text-xs text-muted-foreground">
            Seleccioná un nodo arriba para ver su historial de telemetría.
          </p>
        </div>
      ) : loading && history.length === 0 ? (
        <div className="space-y-2 px-5 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
          <SearchX className="size-10 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Sin datos de historial</p>
          <p className="text-xs text-muted-foreground">
            No se encontraron registros de telemetría para este nodo.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-275 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left">
                  <Th>Fecha y hora</Th>
                  <Th className="text-right">CPU</Th>
                  <Th className="text-right">RAM libre</Th>
                  <Th className="text-right">Chip</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
