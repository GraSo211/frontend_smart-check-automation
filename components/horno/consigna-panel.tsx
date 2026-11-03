"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getConsignaHistorial } from "@/actions/api"
import { ConsignaForm } from "@/components/horno/consigna-form"
import { ConsignaHistorial } from "@/components/horno/consigna-historial"
import { HornoEstadoCard } from "@/components/horno/horno-estado-card"
import type { Consigna, HornoEstado, LoteSector, Producto } from "@/lib/production-data"

interface LoteOption {
  id: string
  label: string
  modo?: NonNullable<LoteSector["modo"]>
}

interface ConsignaPanelProps {
  hornoId: string
  productos: Producto[]
  loteOptions: LoteOption[]
  initialLoteId: string
  initialHistorial: Consigna[]
  initialHistorialError?: string | null
  hornoEstado: HornoEstado | null
  hornoError?: string | null
}

export function ConsignaPanel({
  hornoId,
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

  const loadHistorial = async (id: string) => {
    if (!id) {
      setHistorial([])
      setHistorialError(null)
      return
    }

    setLoadingHistorial(true)
    try {
      const data = await getConsignaHistorial(id)
      setHistorial(data)
      setHistorialError(null)
    } catch (error) {
      setHistorial([])
      setHistorialError(
        error instanceof Error ? error.message : "No se pudo cargar el historial.",
      )
    } finally {
      setLoadingHistorial(false)
    }
  }

  const handleLoteChange = (value: string) => {
    setLoteId(value)
    void loadHistorial(value)
  }

  const handleSent = async (sentLoteId: string) => {
    if (sentLoteId && sentLoteId !== loteId) {
      setLoteId(sentLoteId)
    }
    await loadHistorial(sentLoteId)
    router.refresh()
  }

  const loteSeleccionado = loteOptions.find((l) => l.id === loteId)
  const modoSeleccionado = loteSeleccionado?.modo ?? null
  const hayLoteAutomatico = loteOptions.some(
    (l) => l.modo === "SUPERVISION" || l.modo === "AUTOMATICO",
  )
  const bloqueadaPorModo = modoSeleccionado
    ? modoSeleccionado === "SUPERVISION" || modoSeleccionado === "AUTOMATICO"
    : hayLoteAutomatico
  const motivoBloqueo = bloqueadaPorModo
    ? modoSeleccionado
      ? `El lote seleccionado está en modo ${modoSeleccionado}. Cambialo a modo MANUAL desde Control del lote para enviar una consigna manual.`
      : "Hay un lote abierto en modo SUPERVISION o AUTOMATICO. Elegí un lote en modo MANUAL o cambialo a MANUAL desde Control del lote para enviar una consigna manual."
    : null

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ConsignaForm
          hornoId={hornoId}
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
