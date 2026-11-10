"use client"

import { Search, X } from "lucide-react"
import { SectorSelect } from "@/components/shared/sector-select"
import type { Sector } from "@/lib/production-data"

export type EstadoFilter = "todos" | "ABIERTO" | "CERRADO"

export interface FiltersState {
  search: string
  estado: EstadoFilter
}

export const DEFAULT_FILTERS: FiltersState = {
  search: "",
  estado: "todos",
}

interface FiltersBarProps {
  filters: FiltersState
  onChange: (filters: FiltersState) => void
  /** Sectores disponibles para acotar la supervisión. */
  sectores: Sector[]
  /** Sector activo (vive en la URL, no en `filters`). */
  selectedSectorId: string | null
  onSectorChange: (id: string) => void
  resultsCount: number
  totalCount: number
}

export function FiltersBar({
  filters,
  onChange,
  sectores,
  selectedSectorId,
  onSectorChange,
  resultsCount,
  totalCount,
}: FiltersBarProps) {
  const hasActiveFilters = filters.search !== "" || filters.estado !== "todos"
  const hasSectores = sectores.length > 0

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Filtros</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Acotá la supervisión por sector, producto y estado del lote.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          {resultsCount === totalCount
            ? `${totalCount} registros`
            : `${resultsCount} de ${totalCount} registros`}
        </span>
      </div>

      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="w-full sm:w-56">
            <SectorSelect
              id="sector"
              label="Sector"
              value={selectedSectorId ?? ""}
              onChange={onSectorChange}
              sectores={sectores}
              disabled={!hasSectores}
            />
          </div>

          <div className="flex-1">
            <label
              htmlFor="search"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Buscar producto
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="search"
                type="text"
                value={filters.search}
                onChange={(e) => onChange({ ...filters, search: e.target.value })}
                placeholder="Tostada Integral..."
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          <div className="w-full sm:w-44">
            <label
              htmlFor="estado"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Estado
            </label>
            <select
              id="estado"
              value={filters.estado}
              onChange={(e) =>
                onChange({ ...filters, estado: e.target.value as EstadoFilter })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="todos">Todos</option>
              <option value="ABIERTO">Abierto</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <X className="size-3.5" aria-hidden="true" />
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}
