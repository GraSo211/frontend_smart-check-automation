"use client"

import { useEffect, useMemo, useState } from "react"
import { KpiCards } from "@/components/kpi-cards"
import { SupervisionTable } from "@/components/supervision-table"
import { FiltersBar, DEFAULT_FILTERS, type FiltersState } from "@/components/filters-bar"
import { setLastSync } from "@/lib/sync-store"
import type { ProductionRun } from "@/lib/production-data"

interface DashboardContentProps {
  runs: ProductionRun[]
  lastSyncAt: string | null
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
