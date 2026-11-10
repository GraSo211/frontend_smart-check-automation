"use client"

import type { ServiceStatus } from "@/lib/monitoring-types"

const AVAILABILITY_LABELS = {
  available: "Disponible",
  degraded: "Degradado",
  disconnected: "Desconectado",
  unknown: "Desconocido",
} as const

export function availabilityLabel(availability: ServiceStatus["availability"]) {
  return AVAILABILITY_LABELS[availability]
}

export function MonitoringStatus({ label, status }: { label: string; status: ServiceStatus }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border">
      <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <span className="truncate">{label}: {availabilityLabel(status.availability)}</span>
    </span>
  )
}
