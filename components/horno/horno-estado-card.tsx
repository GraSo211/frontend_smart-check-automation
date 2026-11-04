import type { ElementType } from "react"
import { Activity, AlertCircle, Gauge, Thermometer } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, formatDecimal, formatNumber, formatPct, formatTemp, formatTime } from "@/lib/format"
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
        Activo
      </span>
    )
  }
  if (upper === "DESACTUALIZADO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        Desactualizado
      </span>
    )
  }
  if (upper === "CONTROL_MANUAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        Control manual
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
      {estado}
    </span>
  )
}

function subtitulo(estado: HornoEstado): string {
  if (estado.ultimo_check) {
    return `Última telemetría de la Pi: ${formatDate(estado.ultimo_check)} · ${formatTime(estado.ultimo_check)}`
  }
  switch (estado.estado) {
    case "SIN_LOTE":
      return "Esperando a que se abra un lote en este sector."
    case "SIN_TELEMETRIA":
      return "La Pi todavía no publicó telemetría para este sector."
    case "SIN_DATOS":
      return "La última muestra no trajo lecturas de los sensores."
    default:
      return "Sin telemetría reciente de la Pi."
  }
}

function mensajeEstado(estado: HornoEstado): { texto: string; variante: "muted" | "warning" } | null {
  switch (estado.estado) {
    case "SIN_LOTE":
      return {
        texto: "No hay un lote abierto en este sector. La Pi publica telemetría mientras hay un lote abierto.",
        variante: "muted",
      }
    case "SIN_TELEMETRIA":
      return {
        texto: "La Pi todavía no publicó telemetría para el lote abierto.",
        variante: "muted",
      }
    case "SIN_DATOS":
      return {
        texto: "La última muestra no trajo lecturas de los sensores.",
        variante: "muted",
      }
    case "DESACTUALIZADO": {
      const seg = estado.antiguedad_segundos
      return {
        texto:
          seg != null
            ? `La última muestra tiene ${formatNumber(seg)} s; la Pi publica cada 5 s.`
            : "La última muestra está desactualizada; la Pi publica cada 5 s.",
        variante: "warning",
      }
    }
    case "CONTROL_MANUAL":
      return {
        texto: "El backend no pudo confirmar el enlace con el controlador; revisá las alertas.",
        variante: "warning",
      }
    default:
      return null
  }
}

function MetricaPrincipal({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: ElementType
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function MetricaSecundaria({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
    </div>
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
            {error ?? "No se pudo consultar la telemetría del horno en este momento."}
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

  const mensaje = mensajeEstado(estado)

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
            <CardDescription>{subtitulo(estado)}</CardDescription>
          </div>
          {estadoBadge(estado.estado)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricaPrincipal
            label="Temperatura (T1)"
            value={formatTemp(estado.temperatura)}
            icon={Thermometer}
          />
          <MetricaPrincipal
            label="Velocidad de cinta"
            value={formatDecimal(estado.velocidad_cinta, 2, "m/s")}
            icon={Gauge}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricaSecundaria label="Temp. combustión" value={formatTemp(estado.temp_comb_1 ?? null)} />
          <MetricaSecundaria label="Humedad horno" value={formatDecimal(estado.humedad_horno ?? null, 1, "%")} />
          <MetricaSecundaria label="Temp. ambiente" value={formatTemp(estado.temp_ambiente ?? null)} />
          <MetricaSecundaria label="Humedad ambiente" value={formatDecimal(estado.humedad_ambiente ?? null, 1, "%")} />
          <MetricaSecundaria label="Temp. objetivo" value={formatTemp(estado.temp_objetivo ?? null)} />
          <MetricaSecundaria label="Vel. objetivo" value={formatDecimal(estado.vel_objetivo ?? null, 2, "m/s")} />
          <MetricaSecundaria label="Confianza" value={formatPct(estado.confianza_deteccion ?? null)} />
        </div>

        {mensaje && (
          <div
            role="status"
            className={
              mensaje.variante === "warning"
                ? "mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
                : "mt-4 flex items-start gap-3 rounded-lg border border-info/20 bg-info/10 p-3 text-sm text-info"
            }
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {mensaje.texto}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
