"use client"

import { useMemo, useState } from "react"
import { KpiCards } from "@/components/kpi-cards"
import { SupervisionTable } from "@/components/supervision-table"
import { FiltersBar, DEFAULT_FILTERS, type FiltersState } from "@/components/filters-bar"
import type { ProductionRun } from "@/lib/production-data"

interface DashboardContentProps {
  runs: ProductionRun[]
}

function filterRuns(runs: ProductionRun[], filters: FiltersState): ProductionRun[] {
  return runs.filter((run) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!run.productoNombre.toLowerCase().includes(q)) return false
    }
    if (filters.turno !== "todos" && run.turno !== filters.turno) return false
    const avgTemp = (run.temp_horno_1 + run.temp_horno_2) / 2
    if (filters.tempMin !== "" && avgTemp < Number(filters.tempMin)) return false
    if (filters.tempMax !== "" && avgTemp > Number(filters.tempMax)) return false
    return true
  })
}

export function DashboardContent({ runs }: DashboardContentProps) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)

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
