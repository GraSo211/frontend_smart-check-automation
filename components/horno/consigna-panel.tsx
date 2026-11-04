"use client"

import { useRef, useState } from "react"
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

  const loadHistorial = async (id: string) => {
    const requestId = ++historialRequest.current

    if (!id) {
      setHistorial([])
      setHistorialError(null)
      return
    }

    setLoadingHistorial(true)
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
      if (historialRequest.current === requestId) setLoadingHistorial(false)
    }
  }

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
  const hayLoteAutomatico = loteOptions.some(
    (l) => l.modo === "SUPERVISION" || l.modo === "AUTOMATICO",
  )

  const sinSectores = sectores.length === 0
  const bloqueadaPorModo = sinSectores
    ? true
    : modoSeleccionado
      ? modoSeleccionado === "SUPERVISION" || modoSeleccionado === "AUTOMATICO"
      : hayLoteAutomatico
  const motivoBloqueo = sinSectores
    ? "No hay sectores configurados. La consigna manual necesita al menos un sector con su horno."
    : bloqueadaPorModo
      ? modoSeleccionado
        ? `El lote seleccionado está en modo ${modoSeleccionado}. Cambialo a modo MANUAL desde Control del lote para enviar una consigna manual.`
        : "Hay un lote abierto en modo SUPERVISION o AUTOMATICO. Elegí un lote en modo MANUAL o cambialo a MANUAL desde Control del lote para enviar una consigna manual."
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
            hint="Cada sector tiene su horno. La consigna se envía al horno del sector seleccionado."
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
