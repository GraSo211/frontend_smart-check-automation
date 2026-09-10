"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Server } from "lucide-react"
import { DeviceCard } from "@/components/nodos/device-card"
import { DeviceHistory } from "@/components/nodos/device-history"
import { TelemetryDashboard } from "@/components/nodos/telemetry-dashboard"
import { getDeviceHistory } from "@/actions/api"
import { mergeIncomingTelemetrySamples, samplesForDevice } from "@/lib/telemetry"
import type { Device, SpecificDevice } from "@/lib/devices-data"
import { parseDeviceEventPayload } from "@/lib/monitoring-runtime"
import { useMonitoringActions, useMonitoringNodes } from "@/components/monitoring-provider"

const HISTORY_CAP = 100

interface DevicesStateProps {
  devices: Device[]
  lastSyncAt: string | null
}

// Client container for the node fleet: selection state, live SSE telemetry
// and the history section of the currently selected device.
export default function DevicesState({ devices: initialDevices, lastSyncAt }: DevicesStateProps) {
  const monitoredDevices = useMonitoringNodes()
  const actions = useMonitoringActions()
  const allDevices = monitoredDevices ?? initialDevices
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [history, setHistory] = useState<SpecificDevice[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const selectedDeviceIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId
  }, [selectedDeviceId])

  useEffect(() => {
    actions.seedNodes(initialDevices, lastSyncAt)
  }, [actions, initialDevices, lastSyncAt])

  useEffect(() => {
    if (typeof window === "undefined") return
    const eventSource = new EventSource("/api/nodos/events")

    const applyDeviceUpdate = (update: Device, payload: unknown, addToHistory: boolean) => {
      if (!actions.acceptNodeEvent(payload)) return
      if (addToHistory && update.ultimaMetrica && selectedDeviceIdRef.current === update.dispositivoId) {
        const m = update.ultimaMetrica
        const row: SpecificDevice = {
          id: m.id,
          dispositivoId: update.dispositivoId,
          nombre: update.nombre,
          cpuPct: m.cpuPct,
          memRamDisponibleMb: m.memRamDisponibleMb,
          memRamTotalMb: m.memRamTotalMb,
          almacenamientoDisponibleMb: m.almacenamientoDisponibleMb,
          almacenamientoTotalMb: m.almacenamientoTotalMb,
          tempChip: m.tempChip,
          aiProcessorPct: m.aiProcessorPct,
          receivedAt: m.receivedAt,
        }
        setHistory((prev) => {
          return mergeIncomingTelemetrySamples(prev, [row], HISTORY_CAP)
        })
      }

    }

    eventSource.addEventListener("dispositivo.metric", (event) => {
      try {
        const payload: unknown = JSON.parse((event as MessageEvent).data)
        const update = parseDeviceEventPayload(payload)
        if (update) applyDeviceUpdate(update, payload, true)
      } catch { /* A malformed event is not a synchronization confirmation. */ }
    })

    eventSource.onopen = () => {
      actions.streamState("nodos", "open")
      void actions.refreshNodes()
    }

    eventSource.addEventListener("dispositivo.state", (event) => {
      try {
        const payload: unknown = JSON.parse((event as MessageEvent).data)
        const update = parseDeviceEventPayload(payload)
        if (update) applyDeviceUpdate(update, payload, false)
      } catch { /* A malformed event is not a synchronization confirmation. */ }
    })

    eventSource.onerror = () => {
      actions.streamState("nodos", "error", "El stream de nodos no está disponible.")
    }

    return () => {
      eventSource.close()
      actions.streamState("nodos", "closed")
    }
  }, [actions])

  useEffect(() => {
    if (!selectedDeviceId) return

    let cancelled = false
    getDeviceHistory(selectedDeviceId)
      .then((rows) => {
        if (!cancelled) {
          setHistory((current) => mergeIncomingTelemetrySamples(
            current,
            samplesForDevice(rows, selectedDeviceId),
            HISTORY_CAP,
          ))
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryError("No se pudo cargar el historial. Los reportes históricos no están disponibles.")
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDeviceId])

  const handleSelect = (dispositivoId: string) => {
    const nextSelectedDeviceId = selectedDeviceId === dispositivoId ? null : dispositivoId
    selectedDeviceIdRef.current = nextSelectedDeviceId
    setSelectedDeviceId(nextSelectedDeviceId)
    setHistory([])
    setHistoryError(null)
    setLoadingHistory(Boolean(nextSelectedDeviceId))
  }

  // If the selected device is removed, clear the selection so the history
  // panel doesn't keep pointing at a node that no longer exists.
  const handleDeviceDeleted = (dispositivoId: string) => {
    if (selectedDeviceId !== dispositivoId) return
    selectedDeviceIdRef.current = null
    setSelectedDeviceId(null)
    setHistory([])
    setHistoryError(null)
    setLoadingHistory(false)
  }

  const selectedDevice = useMemo(
    () => allDevices.find((d) => d.dispositivoId === selectedDeviceId) ?? null,
    [allDevices, selectedDeviceId],
  )

  const onlineCount = allDevices.filter((d) => d.estado === "online").length
  const offlineCount = allDevices.length - onlineCount

  return (
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="nodos-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="nodos-heading" className="text-base font-semibold text-foreground">
              Nodos de la flota
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Estado en tiempo real y última telemetría de cada dispositivo.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {onlineCount} online · {offlineCount} offline
          </span>
        </div>

        {allDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              <Server className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">No hay nodos registrados</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Cuando se registren dispositivos, vas a poder ver su estado y telemetría acá.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allDevices.map((device) => (
              <DeviceCard
                key={device.dispositivoId}
                device={device}
                selected={selectedDeviceId === device.dispositivoId}
                onSelect={handleSelect}
                onDeleted={handleDeviceDeleted}
              />
            ))}
          </div>
        )}
      </section>

      {selectedDevice && <TelemetryDashboard device={selectedDevice} history={history} />}

      <DeviceHistory
        deviceId={selectedDeviceId}
        deviceName={selectedDevice?.nombre ?? null}
        history={history}
        loading={loadingHistory}
        error={historyError}
      />
    </div>
  )
}
