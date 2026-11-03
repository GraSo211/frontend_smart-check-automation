import { Activity, AlertCircle, Gauge, Thermometer } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, formatTemp, formatTime } from "@/lib/format"
import type { HornoEstado } from "@/lib/production-data"

interface HornoEstadoCardProps {
  estado: HornoEstado | null
  error?: string | null
}

function estadoBadge(estado: string) {
  const upper = estado.toUpperCase()
  if (upper === "ACTIVO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        {estado}
      </span>
    )
  }
  if (upper === "CONTROL_MANUAL" || upper === "MANUAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        {estado}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
      {estado}
    </span>
  )
}

export function HornoEstadoCard({ estado, error }: HornoEstadoCardProps) {
  if (!estado) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <Activity className="size-3.5" aria-hidden="true" />
            Estado actual
          </div>
          <CardTitle className="text-base font-semibold">Estado del horno</CardTitle>
          <CardDescription>
            {error ?? "No se pudo consultar el estado del horno en este momento."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Datos no disponibles
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <Activity className="size-3.5" aria-hidden="true" />
          Estado actual
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{estado.nombre}</CardTitle>
            <CardDescription>
              Último check: {formatDate(estado.ultimo_check)} · {formatTime(estado.ultimo_check)}
            </CardDescription>
          </div>
          {estadoBadge(estado.estado)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground">
              <Thermometer className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Temperatura</p>
              <p className="text-lg font-semibold tracking-tight">{formatTemp(estado.temperatura)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground">
              <Gauge className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Velocidad de cinta</p>
              <p className="text-lg font-semibold tracking-tight">
                {estado.velocidad_cinta.toLocaleString("es-AR", { maximumFractionDigits: 2 })} m/s
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
