"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Server } from "lucide-react"
import { DeviceCard } from "@/components/nodos/device-card"
import { DeviceHistory } from "@/components/nodos/device-history"
import { TelemetryDashboard } from "@/components/nodos/telemetry-dashboard"
import { getDeviceHistory } from "@/actions/api"
import { setLastSync } from "@/lib/sync-store"
import { mergeDeviceUpdate, mergeIncomingTelemetrySamples, reconcileDeviceSnapshot, samplesForDevice } from "@/lib/telemetry"
import type { Device, SpecificDevice } from "@/lib/devices-data"

const HISTORY_CAP = 100

interface DevicesStateProps {
  devices: Device[]
  lastSyncAt: string | null
}

// Client container for the node fleet: selection state, live SSE telemetry
// and the history section of the currently selected device.
export default function DevicesState({ devices: initialDevices, lastSyncAt }: DevicesStateProps) {
  const [allDevices, setAllDevices] = useState<Device[]>(initialDevices)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [history, setHistory] = useState<SpecificDevice[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const selectedDeviceIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId
  }, [selectedDeviceId])

  useEffect(() => {
    if (lastSyncAt) setLastSync(lastSyncAt)
  }, [lastSyncAt])

  useEffect(() => {
    setAllDevices(initialDevices)
  }, [initialDevices])

  useEffect(() => {
    if (typeof window === "undefined") return
    const reconcile = async () => {
      try {
        const response = await fetch("/api/nodos/snapshot", { cache: "no-store" })
        if (!response.ok) return
        const payload = await response.json()
        const snapshot = Array.isArray(payload) ? payload : payload.data
        if (Array.isArray(snapshot)) {
          setAllDevices((current) => reconcileDeviceSnapshot(current, snapshot))
        }
      } catch { /* SSE remains the source of live updates while a snapshot retries. */ }
    }
    const eventSource = new EventSource("/api/nodos/events")

    const applyDeviceUpdate = (update: Device, addToHistory: boolean) => {
      setAllDevices((prev) =>
        prev.map((d) => {
          if (d.dispositivoId !== update.dispositivoId) return d
          return mergeDeviceUpdate(d, update)
        }),
      )

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

      setLastSync(new Date().toISOString())
    }

    eventSource.addEventListener("dispositivo.metric", (event) => {
      const response = JSON.parse((event as MessageEvent).data)
      const update: Device = response.data
      console.log("Métrica de dispositivo recibida:", update)
      applyDeviceUpdate(update, true)
    })

    eventSource.onopen = reconcile
    void reconcile()
    const reconciliationTimer = window.setInterval(reconcile, 60_000)

    eventSource.addEventListener("dispositivo.state", (event) => {
      const response = JSON.parse((event as MessageEvent).data)
      const update: Device = response.data
      console.log("Estado de dispositivo recibido:", update)
      applyDeviceUpdate(update, false)
    })

    eventSource.onerror = () => {
      console.error("Error al conectarse con el servidor:", eventSource.readyState)
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("Conexión cerrada definitivamente por el navegador.")
        eventSource.close()
      }
    }

    return () => {
      eventSource.close()
      window.clearInterval(reconciliationTimer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setHistory([])
    setHistoryError(null)
    if (!selectedDeviceId) {
      setLoadingHistory(false)
      return
    }

    setLoadingHistory(true)
    getDeviceHistory(selectedDeviceId)
      .then((rows) => {
        if (!cancelled) {
          setHistory(mergeIncomingTelemetrySamples([], samplesForDevice(rows, selectedDeviceId), HISTORY_CAP))
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
    setSelectedDeviceId((current) => (current === dispositivoId ? null : dispositivoId))
  }

  // If the selected device is removed, clear the selection so the history
  // panel doesn't keep pointing at a node that no longer exists.
  const handleDeviceDeleted = (dispositivoId: string) => {
    setSelectedDeviceId((current) => (current === dispositivoId ? null : current))
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
