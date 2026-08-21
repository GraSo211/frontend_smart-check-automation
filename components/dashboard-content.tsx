"use client"

import { useEffect, useMemo, useState } from "react"
import { KpiCards } from "@/components/lotes/kpi-cards"
import { SupervisionTable } from "@/components/lotes/supervision-table"
import { FiltersBar, DEFAULT_FILTERS, type FiltersState } from "@/components/lotes/filters-bar"
import { setLastSync } from "@/lib/sync-store"
import { formatNumber } from "@/lib/format"
import type { UserRole } from "@/lib/auth"
import type { ProductionRun } from "@/lib/production-data"

interface DashboardContentProps {
  runs: ProductionRun[]
  lastSyncAt: string | null
  userRole?: UserRole
}

function filterRuns(runs: ProductionRun[], filters: FiltersState): ProductionRun[] {
  return runs.filter((run) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!run.productoNombre.toLowerCase().includes(q)) return false
    }
    if (filters.turno !== "todos" && run.turno !== filters.turno) return false
    const avgTemp = (run.tempHorno1 + run.tempHorno2) / 2
    if (filters.tempMin !== "" && avgTemp < Number(filters.tempMin)) return false
    if (filters.tempMax !== "" && avgTemp > Number(filters.tempMax)) return false
    return true
  })
}

export function DashboardContent({ runs, lastSyncAt }: DashboardContentProps) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)

  useEffect(() => {
    if (lastSyncAt) setLastSync(lastSyncAt)
  }, [lastSyncAt])

  const filteredRuns = useMemo(() => filterRuns(runs, filters), [runs, filters])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Resumen de Producción</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Métricas agregadas y detalle de los lotes registrados.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          {formatNumber(runs.length)} {runs.length === 1 ? "lote" : "lotes"}
        </span>
      </div>

      <KpiCards runs={filteredRuns} />
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        resultsCount={filteredRuns.length}
        totalCount={runs.length}
      />
      <SupervisionTable runs={filteredRuns} />
    </div>
  )
}
