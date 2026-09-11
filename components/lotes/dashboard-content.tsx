"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CircleAlert } from "lucide-react"
import { KpiCards } from "@/components/lotes/kpi-cards"
import { SupervisionTable } from "@/components/lotes/supervision-table"
import { FiltersBar, DEFAULT_FILTERS, type FiltersState } from "@/components/lotes/filters-bar"
import type { ProductionRun } from "@/lib/production-data"
import { useMonitoringActions, useProductionData } from "@/components/monitoring-provider"
import { ConnectionIndicator, type ConnectionState } from "@/components/shared/connection-indicator"

interface DashboardContentProps {
  runs: ProductionRun[]
  lastSyncAt: string | null
  initialError?: string | null
}

function hasInvalidTempRange(filters: FiltersState): boolean {
  return (
    filters.tempMin !== "" &&
    filters.tempMax !== "" &&
    Number(filters.tempMin) > Number(filters.tempMax)
  )
}

function filterRuns(runs: ProductionRun[], filters: FiltersState): ProductionRun[] {
  if (!Array.isArray(runs) || runs.length === 0) return []
  const tempRangeInvalid = hasInvalidTempRange(filters)
  return runs.filter((run) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!run.productoNombre.toLowerCase().includes(q)) return false
    }
    if (filters.turno !== "todos" && run.turno !== filters.turno) return false
    // Un rango inválido (mín > máx) no se aplica para evitar un vacío silencioso.
    if (!tempRangeInvalid) {
      const avgTemp = (run.tempHorno1 + run.tempHorno2) / 2
      if (filters.tempMin !== "" && avgTemp < Number(filters.tempMin)) return false
      if (filters.tempMax !== "" && avgTemp > Number(filters.tempMax)) return false
    }
    return true
  })
}

export function DashboardContent({ runs: initialRuns, lastSyncAt, initialError = null }: DashboardContentProps) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const production = useProductionData(initialRuns, lastSyncAt, initialError)
  const actions = useMonitoringActions()
  const refreshProduction = production.refresh
  const [streamState, setStreamState] = useState<ConnectionState>("unknown")
  const [streamRetry, setStreamRetry] = useState(0)
  const streamEpochRef = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    let disposed = false
    let eventSource: EventSource | null = null

    const syncConnection = (current: EventSource) => {
      const syncEpoch = ++streamEpochRef.current
      setStreamState("reconnecting")
      void (async () => {
        await refreshProduction()
        const second = await refreshProduction()
        if (!disposed && syncEpoch === streamEpochRef.current && document.visibilityState === "visible" && current.readyState === (EventSource.OPEN ?? 1) && second === true) setStreamState("connected")
      })()
    }

    const createStream = () => {
      ++streamEpochRef.current
      const current = new EventSource('/api/lotes/events')
      eventSource = current
      current.addEventListener("lote.created", (event) => {
        try {
          const payload: unknown = JSON.parse((event as MessageEvent).data)
          // Validation and synchronization confirmation both live in the provider.
          actions.acceptLoteEvent(payload)
        } catch { /* Malformed SSE data is ignored and never confirms synchronization. */ }
      })
      current.onopen = () => {
        actions.streamState("lotes", "open")
        syncConnection(current)
      }
      current.onerror = () => {
        streamEpochRef.current += 1
        setStreamState(current.readyState === EventSource.CLOSED ? "disconnected" : "reconnecting")
        actions.streamState("lotes", "error", "El stream de lotes no está disponible.")
      }
    }
    createStream()
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        streamEpochRef.current += 1
        setStreamState("reconnecting")
      } else if (eventSource?.readyState === (EventSource.OPEN ?? 1)) {
        syncConnection(eventSource)
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      disposed = true
      streamEpochRef.current += 1
      document.removeEventListener("visibilitychange", onVisibilityChange)
      eventSource?.close()
      actions.streamState("lotes", "closed")
    }
  }, [actions, refreshProduction, streamRetry])

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
      <div className="flex justify-end"><ConnectionIndicator state={streamState} label="Lotes" onRetry={() => setStreamRetry((retry) => retry + 1)} disabled={production.loading} /></div>
      <KpiCards runs={filteredRuns} />
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        resultsCount={filteredRuns.length}
        totalCount={production.runs.length}
        tempRangeInvalid={hasInvalidTempRange(filters)}
      />
      <SupervisionTable runs={filteredRuns} />
    </div>
  )
}
