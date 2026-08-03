"use client"

import { useEffect, useMemo, useState } from "react"
import { DeviceCard } from "@/components/nodos/device-card"
import { DeviceHistory } from "@/components/nodos/device-history"
import { getDeviceHistory } from "@/actions/api"
import { setLastSync } from "@/lib/sync-store"
import type { Device, DeviceResponse, SpecificDevice } from "@/lib/devices-data"

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

  useEffect(() => {
    if (lastSyncAt) setLastSync(lastSyncAt)
  }, [lastSyncAt])

  useEffect(() => {
    setAllDevices(initialDevices)
  }, [initialDevices])

  useEffect(() => {
    if (typeof window === "undefined") return
    const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/dispositivos/events`)

    eventSource.addEventListener("dispositivo.metric", (event) => {
      const response = JSON.parse((event as MessageEvent).data)
      const update: Device = response.data
      console.log("Métrica de dispositivo recibida:", update)
      setAllDevices((prev) =>
        prev.map((d) => {
          if (d.dispositivoId !== update.dispositivoId) return d
          return {
            ...d,
            ...update,
            ultimaMetrica: update.ultimaMetrica
              ? { ...d.ultimaMetrica, ...update.ultimaMetrica }
              : d.ultimaMetrica,
          }
        }),
      )
      setLastSync(new Date().toISOString())
    })

    eventSource.addEventListener("dispositivo.state", (event) => {
      const response = JSON.parse((event as MessageEvent).data)
      const update: Device = response.data
      console.log("Métrica de dispositivo recibida:", update)
      setAllDevices((prev) =>
        prev.map((d) => {
          if (d.dispositivoId !== update.dispositivoId) return d
          return {
            ...d,
            ...update,
            ultimaMetrica: update.ultimaMetrica
              ? { ...d.ultimaMetrica, ...update.ultimaMetrica }
              : d.ultimaMetrica,
          }
        }),
      )
      setLastSync(new Date().toISOString())
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
    }
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) {
      setHistory([])
      return
    }

    let cancelled = false
    setLoadingHistory(true)
    getDeviceHistory(selectedDeviceId)
      .then((rows) => {
        if (!cancelled) setHistory(rows)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
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

  const selectedDevice = useMemo(
    () => allDevices.find((d) => d.dispositivoId === selectedDeviceId) ?? null,
    [allDevices, selectedDeviceId],
  )

  const onlineCount = allDevices.filter((d) => d.estado === "online").length
  const offlineCount = allDevices.length - onlineCount

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {onlineCount} nodo{onlineCount === 1 ? "" : "s"} online · {offlineCount}{" "}
        {offlineCount === 1 ? "nodo" : "nodos"} offline
      </p>

      <section aria-label="Estado de los nodos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allDevices.map((device) => (
          <DeviceCard
            key={device.dispositivoId}
            device={device}
            selected={selectedDeviceId === device.dispositivoId}
            onSelect={handleSelect}
          />
        ))}
      </section>

      <DeviceHistory
        deviceId={selectedDeviceId}
        deviceName={selectedDevice?.nombre ?? null}
        history={history}
        loading={loadingHistory}
      />
    </div>
  )
}
