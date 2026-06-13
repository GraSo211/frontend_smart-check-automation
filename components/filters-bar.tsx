"use client"

import { Search, X } from "lucide-react"
import type { ProductionRun } from "@/lib/production-data"

export interface FiltersState {
  search: string
  turno: ProductionRun["turno"] | "todos"
  tempMin: string
  tempMax: string
}

export const DEFAULT_FILTERS: FiltersState = {
  search: "",
  turno: "todos",
  tempMin: "",
  tempMax: "",
}

interface FiltersBarProps {
  filters: FiltersState
  onChange: (filters: FiltersState) => void
  resultsCount: number
  totalCount: number
}

export function FiltersBar({ filters, onChange, resultsCount, totalCount }: FiltersBarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.turno !== "todos" ||
    filters.tempMin !== "" ||
    filters.tempMax !== ""

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
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

        <div className="w-full sm:w-40">
          <label
            htmlFor="turno"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Turno
          </label>
          <select
            id="turno"
            value={filters.turno}
            onChange={(e) =>
              onChange({
                ...filters,
                turno: e.target.value as FiltersState["turno"],
              })
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="todos">Todos</option>
            <option value="mañana">Mañana</option>
            <option value="tarde">Tarde</option>
            <option value="noche">Noche</option>
          </select>
        </div>

        <div className="w-full sm:w-28">
          <label
            htmlFor="tempMin"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Temp. mín (°C)
          </label>
          <input
            id="tempMin"
            type="number"
            min={0}
            max={300}
            value={filters.tempMin}
            onChange={(e) => onChange({ ...filters, tempMin: e.target.value })}
            placeholder="0"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="w-full sm:w-28">
          <label
            htmlFor="tempMax"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Temp. máx (°C)
          </label>
          <input
            id="tempMax"
            type="number"
            min={0}
            max={300}
            value={filters.tempMax}
            onChange={(e) => onChange({ ...filters, tempMax: e.target.value })}
            placeholder="300"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
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

      <p className="mt-3 text-xs text-muted-foreground">
        {resultsCount === totalCount
          ? `${totalCount} registros`
          : `${resultsCount} de ${totalCount} registros`}
      </p>
    </div>
  )
}
