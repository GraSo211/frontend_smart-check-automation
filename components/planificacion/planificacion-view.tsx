"use client"

import { ImportacionCard } from "@/components/planificacion/importacion-card"
import { PlanificacionDatos } from "@/components/planificacion/planificacion-datos"
import type {
  PlanificacionEnergiaItem,
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
  {
    tipo: "energia",
    title: "Energía",
    description:
      "Lecturas de consumo eléctrico (kWh) y gas (m³) por sector y período. Usadas para el cálculo de intensidad energética.",
  },
]

interface PlanificacionViewProps {
  plan: PlanificacionLista<PlanificacionPlanItem>
  paradas: PlanificacionLista<PlanificacionParadaItem>
  energia: PlanificacionLista<PlanificacionEnergiaItem>
  errors: {
    plan?: string
    paradas?: string
    energia?: string
  }
}

export function PlanificacionView({
  plan,
  paradas,
  energia,
  errors,
}: PlanificacionViewProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {TARJETAS.map((tarjeta) => (
          <ImportacionCard key={tarjeta.tipo} {...tarjeta} />
        ))}
      </div>

      <PlanificacionDatos
        plan={plan}
        paradas={paradas}
        energia={energia}
        errors={errors}
      />
    </div>
  )
}
