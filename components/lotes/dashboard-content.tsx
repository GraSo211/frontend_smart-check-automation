"use client"

import { useEffect, useMemo, useState } from "react"
import { CircleAlert } from "lucide-react"
import { KpiCards } from "@/components/lotes/kpi-cards"
import { SupervisionTable } from "@/components/lotes/supervision-table"
import { FiltersBar, DEFAULT_FILTERS, type FiltersState } from "@/components/lotes/filters-bar"
import type { ProductionRun } from "@/lib/production-data"
import { useMonitoringActions, useProductionData } from "@/components/monitoring-provider"

interface DashboardContentProps {
  runs: ProductionRun[]
  lastSyncAt: string | null
  initialError?: string | null
}

function filterRuns(runs: ProductionRun[], filters: FiltersState): ProductionRun[] {
  if (!Array.isArray(runs) || runs.length === 0) return []
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

export function DashboardContent({ runs: initialRuns, lastSyncAt, initialError = null }: DashboardContentProps) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const production = useProductionData(initialRuns, lastSyncAt, initialError)
  const actions = useMonitoringActions()
  const refreshProduction = production.refresh

  useEffect(() => {
    if (typeof window === "undefined") return
    const eventSource = new EventSource('/api/lotes/events')
    eventSource.addEventListener("lote.created", (event) => {
      try {
        const payload: unknown = JSON.parse((event as MessageEvent).data)
        // Validation and synchronization confirmation both live in the provider.
        actions.acceptLoteEvent(payload)
      } catch { /* Malformed SSE data is ignored and never confirms synchronization. */ }
    })
    eventSource.onopen = () => {
      actions.streamState("lotes", "open")
      void refreshProduction()
    }
    eventSource.onerror = () => {
      actions.streamState("lotes", "error", "El stream de lotes no está disponible.")
    }
    return () => {
      eventSource.close()
      actions.streamState("lotes", "closed")
    }
  }, [actions, refreshProduction])

  const filteredRuns = useMemo(() => filterRuns(production.runs, filters), [filters, production.runs])

  return (
    <div className="space-y-8">
      {production.error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground shadow-sm"
        >
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <p>
            <span className="font-medium">
              {production.runs.length > 0 ? "No se pudo actualizar la producción." : "Consulta no disponible."}
            </span>{" "}
            {production.runs.length > 0
              ? "Se conservan los datos confirmados anteriores."
              : production.error}
          </p>
        </div>
      )}
      {production.loading && production.runs.length === 0 && (
        <div role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Consultando datos de producción…
        </div>
      )}
      {!production.error && !production.loading && production.runs.length === 0 && (
        <div role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          No hay datos de producción registrados para mostrar.
        </div>
      )}
      <KpiCards runs={filteredRuns} />
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        resultsCount={filteredRuns.length}
        totalCount={production.runs.length}
      />
      <SupervisionTable runs={filteredRuns} />
    </div>
  )
}
