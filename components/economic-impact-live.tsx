"use client"

import { useEffect, useRef, useState } from "react"
import { ImpactoEconomicoCard } from "@/components/reportes/impacto-economico"
import { isReporteEconomico } from "@/lib/economia-merma"
import type { ReporteEconomico } from "@/lib/reportes-types"

export function EconomicImpactLive({ initial, initialError, refreshKey }: {
  initial?: ReporteEconomico | null
  initialError?: string | null
  refreshKey?: string | null
}) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState(initialError)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    let disposed = false
    let busy = false
    let controller: AbortController | null = null
    const refresh = async () => {
      if (busy) return
      busy = true
      controller = new AbortController()
      const requestController = controller
      const timeout = setTimeout(() => requestController.abort(), 20000)
      try {
        const response = await fetch("/api/reportes/impacto-economico", { cache: "no-store", signal: requestController.signal })
        if (!response.ok) throw new Error("La consulta del KPI no está disponible.")
        const next: unknown = await response.json()
        if (!isReporteEconomico(next)) throw new Error("La API devolvió un KPI inválido.")
        if (!disposed) { setData(next); setError(null) }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "No se pudo consultar el KPI.")
      } finally { clearTimeout(timeout); busy = false }
    }
    // Los eventos de producción disparan una reconciliación con el agregado
    // completo del backend, independiente de la paginación del panel.
    refreshRef.current = refresh
    const interval = setInterval(() => { void refresh() }, 30000)
    return () => { disposed = true; refreshRef.current = null; controller?.abort(); clearInterval(interval) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { void refreshRef.current?.() }, 400)
    return () => clearTimeout(timer)
  }, [refreshKey])

  const periodo = data ? `${data.periodo.desde.split("-").reverse().join("/")} al ${data.periodo.hasta.split("-").reverse().join("/")} · últimos 30 días` : "Últimos 30 días"
  return <ImpactoEconomicoCard data={data?.impacto_economico} periodo={periodo} error={error} detalle={false} />
}
