"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { PageButton } from "@/components/shared/page-button"
import { SectorSelect } from "@/components/shared/sector-select"
import { clampPage, pageCount } from "@/components/shared/pagination-state"
import { Badge } from "@/components/ui/badge"
import type { LoteSector, Sector } from "@/lib/production-data"

const PAGE_SIZE_OPTIONS = [10, 20]
const PLACEHOLDER = "—"

interface ParametersHistoryProps {
  lotes: LoteSector[]
  productoNombre: string
  sectores?: Sector[]
  sector?: Sector | null
  selectedSectorId?: string | null
  productoId?: string | null
  error?: string | null
}

// The contract no longer exposes a close timestamp guarantee, so the window is
// rendered inline: start date+time, then the end time or "en curso".
function formatInicio(lote: LoteSector): string {
  const start = `${formatDate(lote.abierto_en)} · ${formatTime(lote.abierto_en)}`
  if (!lote.cerrado_en) return `${start} · en curso`
  return `${start}–${formatTime(lote.cerrado_en)}`
}

function count(value: number | null): string {
  return value === null ? PLACEHOLDER : formatNumber(value)
}

// Per-product, per-sector batch-run history. The server collects the cursor
// pages up front; pagination here is purely client-side.
export function ParametersHistory({
  lotes,
  productoNombre,
  sectores = [],
  sector = null,
  selectedSectorId = null,
  productoId = null,
  error,
}: ParametersHistoryProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The parent remounts this component (via `key`) when the product/sector
  // selection changes, so pagination state resets to page 1 naturally.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const total = lotes.length
  const totalPages = pageCount(total, pageSize)
  const currentPage = clampPage(page, totalPages)
  const rangeStart = total > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, total)
  const pageItems = lotes.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeSector = (nextSectorId: string) => {
    if (!nextSectorId || nextSectorId === selectedSectorId) return
    const search = new URLSearchParams()
    if (productoId) search.set("productoId", productoId)
    search.set("sector_id", nextSectorId)
    startTransition(() => router.push(`/configuracion?${search.toString()}`))
  }

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
            Corridas de {productoNombre || "este producto"} por sector y producto.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          {error ? "— No disponible" : `${formatNumber(total)} corridas`}
        </span>
      </div>

      <div className="border-b border-border px-5 py-4">
        <div className="w-full sm:w-64">
          <SectorSelect
            id="historial-sector"
            label="Sector"
            value={selectedSectorId ?? ""}
            onChange={changeSector}
            sectores={sectores}
            disabled={pending || sectores.length === 0}
          />
          {sector && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Mostrando el sector <span className="font-medium text-foreground">{sector.nombre}</span>.
            </p>
          )}
        </div>
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
              Aún no hay corridas para {productoNombre || "este producto"} en este sector.
            </p>
          </div>
        </div>
      ) : (
        <>
        {pending && <p role="status" className="border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground">Actualizando historial…</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-250 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left">
                <Th>Inicio</Th>
                <Th>Estado</Th>
                <Th className="text-center">Total</Th>
                <Th className="text-center">Correctos</Th>
                <Th className="text-center">Quemados</Th>
                <Th className="text-center">Crudas</Th>
                <Th>Motivo de cierre</Th>
                <Th>Turno</Th>
                <Th className="text-center">Horno 1</Th>
                <Th className="text-center">Horno 2</Th>
                <Th className="text-center">Vel. cinta</Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((lote) => (
                <tr
                  key={lote.id}
                  className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-muted-foreground">
                    {formatInicio(lote)}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={lote.estado === "ABIERTO" ? "secondary" : "outline"}>
                      {lote.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                    {formatNumber(lote.conteos.total)}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                    {count(lote.conteos.ok)}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                    {count(lote.conteos.quemado)}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono tabular-nums text-foreground">
                    {count(lote.conteos.crudo)}
                  </td>
                  <td className="max-w-50 truncate px-4 py-3.5 text-xs text-muted-foreground" title={lote.motivo_cierre ?? undefined}>
                    {lote.motivo_cierre ?? PLACEHOLDER}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{lote.turno ?? PLACEHOLDER}</td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground">{PLACEHOLDER}</td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground">{PLACEHOLDER}</td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground">{PLACEHOLDER}</td>
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
            <select
              id="historial-page-size"
              value={pageSize}
              disabled={pending}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <PageButton onClick={() => setPage(1)} disabled={currentPage === 1 || pending} aria-label="Primera página"><ChevronsLeft className="size-4" aria-hidden="true" /></PageButton>
            <PageButton
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || pending}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Anterior
            </PageButton>
            <span className="px-2 text-xs font-medium text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <PageButton
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || pending}
            >
              Siguiente
              <ChevronRight className="size-4" aria-hidden="true" />
            </PageButton>
            <PageButton onClick={() => setPage(totalPages)} disabled={currentPage === totalPages || pending} aria-label="Última página"><ChevronsRight className="size-4" aria-hidden="true" /></PageButton>
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
