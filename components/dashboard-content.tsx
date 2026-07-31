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

export function DashboardContent({ runs: initialRuns, lastSyncAt }: DashboardContentProps) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const [allRuns, setAllRuns] = useState<ProductionRun[]>(initialRuns)

  useEffect(() => {
    if (lastSyncAt) setLastSync(lastSyncAt)
  }, [lastSyncAt])

  useEffect(() => {
    setAllRuns(initialRuns)
  }, [initialRuns])

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:8080/api/v1/lotes-productivos/events")


    eventSource.addEventListener("lote.created", (event) => {
      const response = JSON.parse((event as MessageEvent).data)
      const newRun: ProductionRun = response.data
      console.log("Nuevo lote recibido:", newRun)
      setAllRuns((prevRuns) => [newRun, ...prevRuns])
    })

    eventSource.onerror = () => {
      console.error('Error al conectarse con el servidor:', eventSource.readyState);
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("Conexión cerrada definitivamente por el navegador.");
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
    };

  }, [])



  const filteredRuns = useMemo(() => filterRuns(allRuns, filters), [allRuns, filters])

  return (
    <div className="space-y-6">
      <KpiCards runs={filteredRuns} />
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        resultsCount={filteredRuns.length}
        totalCount={allRuns.length}
      />
      <SupervisionTable runs={filteredRuns} />
    </div>
  )
}
