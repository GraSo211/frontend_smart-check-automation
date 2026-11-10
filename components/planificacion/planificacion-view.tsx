"use client"

import { ImportacionCard } from "@/components/planificacion/importacion-card"
import { PlanificacionDatos } from "@/components/planificacion/planificacion-datos"
import type {
  PlanificacionLista,
  PlanificacionParadaItem,
  PlanificacionPlanItem,
} from "@/lib/planificacion-types"
import type { TipoImportacion } from "@/lib/planificacion"

const TARJETAS: {
  tipo: TipoImportacion
  title: string
  description: string
}[] = [
  {
    tipo: "plan",
    title: "Plan de producción",
    description:
      "Programación por sector, fecha, turno, producto y franja horaria. Define los kg planificados para cada ventana.",
  },
  {
    tipo: "paradas",
    title: "Paradas",
    description:
      "Eventos de parada de línea: mantenimiento, limpieza, cambios, etc. Pueden estar asociados a un lote o ser genéricos.",
  },
]

interface PlanificacionViewProps {
  plan: PlanificacionLista<PlanificacionPlanItem>
  paradas: PlanificacionLista<PlanificacionParadaItem>
  errors: {
    plan?: string
    paradas?: string
  }
}

export function PlanificacionView({
  plan,
  paradas,
  errors,
}: PlanificacionViewProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {TARJETAS.map((tarjeta) => (
          <ImportacionCard key={tarjeta.tipo} {...tarjeta} />
        ))}
      </div>

      <PlanificacionDatos
        plan={plan}
        paradas={paradas}
        errors={errors}
      />
    </div>
  )
}
