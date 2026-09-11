"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatRam, formatTemp, formatTime } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { PageButton } from "@/components/shared/page-button"
import { pageCount } from "@/components/shared/pagination-state"
import type { SpecificDevice } from "@/lib/devices-data"

interface Props {
  deviceId: string | null
  deviceName: string | null
  history: SpecificDevice[]
  loading: boolean
  error?: string | null
  total?: number
  page?: number
  onPageChange?: (page: number) => void
  onRetry?: () => void
  stale?: boolean
  newSamples?: number
  onLatest?: () => void
}

export function DeviceHistory({
  deviceId, deviceName, history, loading, error, total = history.length, page = 1,
  onPageChange, onRetry, stale, newSamples = 0, onLatest,
}: Props) {
  const totalPages = pageCount(total, 20)
  const go = (next: number) => onPageChange?.(Math.max(1, Math.min(totalPages, next)))
  const start = total > 0 ? (page - 1) * 20 + 1 : 0
  const end = Math.min(page * 20, total)

  return (
    <section aria-busy={loading} aria-label="Historial de telemetría del dispositivo" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-semibold">Historial del dispositivo</h2><p className="mt-0.5 text-sm text-muted-foreground">{deviceId ? `Telemetría de ${deviceName ?? deviceId}` : "Seleccioná un nodo para ver su historial"}</p></div>
        {deviceId && <span className="rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">{formatNumber(total)} registros</span>}
      </header>

      {!deviceId ? <Empty title="Sin selección" text="Seleccioná un nodo arriba para ver su historial de telemetría." /> : error && history.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-3 px-5 py-16 text-center"><p className="text-sm font-semibold">Historial no disponible</p><p className="text-xs text-muted-foreground">{error}</p><button type="button" onClick={onRetry} className="text-xs font-semibold text-primary underline">Reintentar</button></div>
      ) : loading && history.length === 0 ? <div role="status" className="space-y-2 px-5 py-6"><p className="text-sm text-muted-foreground">Actualizando historial…</p><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : history.length === 0 ? <Empty title="Sin datos de historial" text="No se encontraron registros de telemetría para este nodo." /> : (
        <>
          {loading && <p role="status" className="border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground">Actualizando historial…</p>}
          {stale && <p role="status" className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-xs text-warning">Datos desactualizados. <button type="button" onClick={onRetry} className="font-semibold underline">Reintentar</button></p>}
          {newSamples > 0 && <p role="status" className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-5 py-2 text-xs text-primary">{newSamples} muestras nuevas disponibles. <button type="button" onClick={onLatest} className="font-semibold underline">Volver a recientes</button></p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[40rem] border-collapse text-sm"><thead><tr className="border-b border-border bg-secondary/50 text-left"><Th>Fecha y hora</Th><Th className="text-right">CPU</Th><Th className="text-right">RAM libre</Th><Th className="text-right">Chip</Th><Th className="text-right">IA</Th></tr></thead><tbody>{history.map((row, index) => <tr key={row.id || `${row.dispositivoId}-${row.receivedAt}-${index}`} className="border-b border-border/70 hover:bg-secondary/40"><td className="px-4 py-3.5"><div className="font-mono text-xs">{formatTime(row.receivedAt)}</div><div className="text-xs text-muted-foreground">{formatDate(row.receivedAt)}</div></td><td className="px-4 py-3.5 text-right font-mono">{metric(row.cpuPct, "%")}</td><td className="px-4 py-3.5 text-right font-mono">{formatRam(row.memRamDisponibleMb)}</td><td className="px-4 py-3.5 text-right font-mono">{formatTemp(row.tempChip)}</td><td className="px-4 py-3.5 text-right font-mono">{metric(row.aiProcessorPct, "%")}</td></tr>)}</tbody></table></div>
          <footer className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Mostrando <b className="text-foreground">{start}–{end}</b> de <b className="text-foreground">{formatNumber(total)}</b> elementos</p><div className="flex flex-wrap items-center gap-2"><PageButton onClick={() => go(1)} disabled={page <= 1 || loading} aria-label="Primera página"><ChevronsLeft className="size-4" aria-hidden="true" /></PageButton><PageButton onClick={() => go(page - 1)} disabled={page <= 1 || loading}><ChevronLeft className="size-4" aria-hidden="true" />Anterior</PageButton><span className="px-2 text-xs font-medium text-muted-foreground">Página {page} de {totalPages}</span><PageButton onClick={() => go(page + 1)} disabled={page >= totalPages || loading}>Siguiente<ChevronRight className="size-4" aria-hidden="true" /></PageButton><PageButton onClick={() => go(totalPages)} disabled={page >= totalPages || loading} aria-label="Última página"><ChevronsRight className="size-4" aria-hidden="true" /></PageButton></div></footer>
        </>
      )}
    </section>
  )
}

function metric(value: unknown, suffix: string) { return typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${suffix}` : "Sin datos" }
function Empty({ title, text }: { title: string; text: string }) { return <div className="flex flex-col items-center gap-3 px-5 py-16 text-center"><SearchX className="size-6 text-muted-foreground" aria-hidden="true" /><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div> }
function Th({ children, className }: { children: React.ReactNode; className?: string }) { return <th className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>{children}</th> }
