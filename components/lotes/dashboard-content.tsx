"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert } from "lucide-react"
import { KpiCards } from "@/components/lotes/kpi-cards"
import { SupervisionTable } from "@/components/lotes/supervision-table"
import { LoteAbiertoCard } from "@/components/lotes/lote-abierto-card"
import { FiltersBar, DEFAULT_FILTERS, type FiltersState } from "@/components/lotes/filters-bar"
import type { LoteSector, Sector } from "@/lib/production-data"
import { useMonitoringActions, useProductionData } from "@/components/monitoring-provider"
import { ConnectionIndicator, type ConnectionState } from "@/components/shared/connection-indicator"

interface DashboardContentProps {
  runs: LoteSector[]
  lastSyncAt: string | null
  initialError?: string | null
  sectores: Sector[]
  selectedSectorId: string | null
  initialLoteAbierto: LoteSector | null
}

// The provider store is global (all sectors). Sector scoping happens here, then
// the search/estado filters run over the selected sector's rows.
function filterRuns(
  runs: LoteSector[],
  filters: FiltersState,
): LoteSector[] {
  if (!Array.isArray(runs) || runs.length === 0) return []
  return runs.filter((run) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!run.producto_nombre.toLowerCase().includes(q)) return false
    }
    if (filters.estado !== "todos" && run.estado !== filters.estado) return false
    return true
  })
}

export function DashboardContent({
  runs: initialRuns,
  lastSyncAt,
  initialError = null,
  sectores,
  selectedSectorId,
  initialLoteAbierto,
}: DashboardContentProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const production = useProductionData(initialRuns, lastSyncAt, initialError)
  const actions = useMonitoringActions()
  const refreshProduction = production.refresh
  // `truncated` comes from the frozen provider contract: true when the global
  // snapshot was capped/short, so older history may be missing.
  const truncated = production.truncated
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

    const acceptEvent = (event: Event) => {
      try {
        const payload: unknown = JSON.parse((event as MessageEvent).data)
        // Validation and synchronization confirmation both live in the provider.
        actions.acceptLoteEvent(payload)
      } catch { /* Malformed SSE data is ignored and never confirms synchronization. */ }
    }

    const createStream = () => {
      ++streamEpochRef.current
      const current = new EventSource('/api/lotes/events')
      eventSource = current
      // A lote can be created, updated or closed; all three carry the raw
      // LoteSector. The provider deduplicates by id.
      current.addEventListener("lote.creado", acceptEvent)
      current.addEventListener("lote.actualizado", acceptEvent)
      current.addEventListener("lote.cerrado", acceptEvent)
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

  const sectorRuns = useMemo(
    () =>
      selectedSectorId
        ? production.runs.filter((run) => run.sector_id === selectedSectorId)
        : production.runs,
    [production.runs, selectedSectorId],
  )

  const filteredRuns = useMemo(() => filterRuns(sectorRuns, filters), [sectorRuns, filters])

  // The open lote is scoped to the selected sector and independent from the
  // table's search/estado filters.
  const openLote = useMemo(() => {
    const live = sectorRuns.find((run) => run.estado === "ABIERTO")
    if (live) return live
    // The server-seeded value is only a fallback until the live store has seen
    // its id. Once an SSE `lote.cerrado` upserts that lote as CERRADO into
    // production.runs, the store wins: never resurrect a closed lote as open.
    const storeKnowsIt = production.runs.some((run) => run.id === initialLoteAbierto?.id)
    if (
      initialLoteAbierto &&
      !storeKnowsIt &&
      (!selectedSectorId || initialLoteAbierto.sector_id === selectedSectorId)
    ) {
      return initialLoteAbierto
    }
    return null
  }, [sectorRuns, initialLoteAbierto, selectedSectorId, production.runs])

  const sectorNombre = useMemo(
    () =>
      sectores.find((sector) => sector.id === selectedSectorId)?.nombre ??
      openLote?.sector_id ??
      undefined,
    [sectores, selectedSectorId, openLote],
  )

  const handleSectorChange = (id: string) => {
    if (!id) return
    router.push(`/lotes?sector_id=${encodeURIComponent(id)}`)
  }

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
      {truncated && (
        <div role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Mostrando los lotes más recientes; hay historial más antiguo disponible.
        </div>
      )}
      <div className="flex justify-end"><ConnectionIndicator state={streamState} label="Lotes" onRetry={() => setStreamRetry((retry) => retry + 1)} disabled={production.loading} /></div>
      <LoteAbiertoCard lote={openLote} sectorNombre={sectorNombre} />
      <KpiCards runs={filteredRuns} />
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        sectores={sectores}
        selectedSectorId={selectedSectorId}
        onSectorChange={handleSectorChange}
        resultsCount={filteredRuns.length}
        totalCount={sectorRuns.length}
      />
      <SupervisionTable runs={filteredRuns} sectores={sectores} />
    </div>
  )
}
