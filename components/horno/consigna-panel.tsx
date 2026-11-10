"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getConsignaHistorial } from "@/actions/api"
import { ConsignaForm } from "@/components/horno/consigna-form"
import { ConsignaHistorial } from "@/components/horno/consigna-historial"
import { HornoEstadoCard } from "@/components/horno/horno-estado-card"
import { SectorSelect } from "@/components/shared/sector-select"
import type { Consigna, HornoEstado, LoteOption, Producto, Sector } from "@/lib/production-data"

interface ConsignaPanelProps {
  sectores: Sector[]
  sectorId: string
  productos: Producto[]
  loteOptions: LoteOption[]
  initialLoteId: string
  initialHistorial: Consigna[]
  initialHistorialError?: string | null
  hornoEstado: HornoEstado | null
  hornoError?: string | null
}

export function ConsignaPanel({
  sectores,
  sectorId,
  productos,
  loteOptions,
  initialLoteId,
  initialHistorial,
  initialHistorialError,
  hornoEstado,
  hornoError,
}: ConsignaPanelProps) {
  const router = useRouter()

  const [loteId, setLoteId] = useState(initialLoteId)
  const [historial, setHistorial] = useState(initialHistorial)
  const [historialError, setHistorialError] = useState<string | null>(
    initialHistorialError ?? null,
  )
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const historialRequest = useRef(0)

  const loadHistorial = useCallback(async (id: string, silent = false) => {
    const requestId = ++historialRequest.current

    if (!id) {
      setHistorial([])
      setHistorialError(null)
      return
    }

    if (!silent) setLoadingHistorial(true)
    try {
      const data = await getConsignaHistorial(id)
      if (historialRequest.current !== requestId) return
      setHistorial(data)
      setHistorialError(null)
    } catch (error) {
      if (historialRequest.current !== requestId) return
      setHistorial([])
      setHistorialError(
        error instanceof Error ? error.message : "No se pudo cargar el historial.",
      )
    } finally {
      if (!silent && historialRequest.current === requestId) setLoadingHistorial(false)
    }
  }, [])

  useEffect(() => {
    if (!loteId || !historial.some((c) => c.estado === "PENDIENTE")) return

    const interval = setInterval(() => {
      void loadHistorial(loteId, true)
    }, 10000)

    return () => clearInterval(interval)
  }, [loteId, historial, loadHistorial])

  const handleLoteChange = (value: string) => {
    setLoteId(value)
    void loadHistorial(value)
  }

  const handleSent = async (sentLoteId: string) => {
    await loadHistorial(sentLoteId)
    router.refresh()
  }

  const loteSeleccionado = loteOptions.find((l) => l.id === loteId)
  const modoSeleccionado = loteSeleccionado?.modo ?? null
  const sinLoteAbierto = loteOptions.length === 0

  const sinSectores = sectores.length === 0
  const bloqueadaPorModo =
    sinSectores || sinLoteAbierto || modoSeleccionado !== "MANUAL"
  const motivoBloqueo = sinSectores
    ? "No hay sectores configurados. La consigna manual necesita al menos un sector con su horno."
    : sinLoteAbierto
      ? "No hay un lote abierto en este sector. La consigna manual se aplica a un lote en modo MANUAL."
      : modoSeleccionado && modoSeleccionado !== "MANUAL"
        ? `El lote seleccionado está en modo ${modoSeleccionado}. Cambialo a modo MANUAL desde Control del lote para enviar una consigna manual.`
        : null

  return (
    <div className="space-y-6">
      {sinSectores ? (
        <div
          role="status"
          className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
        >
          <p className="font-medium">No hay sectores configurados</p>
          <p className="text-warning/80">
            La consigna manual necesita al menos un sector con su horno.
          </p>
        </div>
      ) : (
        <div className="max-w-full sm:w-80">
          <SectorSelect
            id="horno-consigna-sector"
            label="Sector"
            value={sectorId}
            sectores={sectores}
            onChange={(id) => router.push(`/horno/consigna?sector_id=${encodeURIComponent(id)}`)}
            hint="Cada sector tiene su horno. La consigna se encola para la Pi del sector seleccionado."
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ConsignaForm
          sectorId={sectorId}
          productos={productos}
          loteOptions={loteOptions}
          loteId={loteId}
          onLoteChange={handleLoteChange}
          onSent={handleSent}
          bloqueadaPorModo={bloqueadaPorModo}
          motivoBloqueo={motivoBloqueo}
        />
        <HornoEstadoCard estado={hornoEstado} error={hornoError} />
      </div>

      {loadingHistorial && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Actualizando historial…
        </div>
      )}

      <ConsignaHistorial consignas={historial} loteId={loteId} error={historialError} />
    </div>
  )
}
