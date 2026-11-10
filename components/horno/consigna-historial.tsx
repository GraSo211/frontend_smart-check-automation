import { History, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, formatTime } from "@/lib/format"
import type { Consigna } from "@/lib/production-data"

interface ConsignaHistorialProps {
  consignas: Consigna[]
  loteId: string | null
  error?: string | null
}

function resultadoBadge(consigna: Consigna) {
  switch (consigna.estado) {
    case "APLICADA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          Aplicada
        </span>
      )
    case "PENDIENTE":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          Pendiente
        </span>
      )
    case "RECHAZADA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
          Rechazada
        </span>
      )
    default:
      if (consigna.exitosa) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Enviada
          </span>
        )
      }
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
          Rechazada
        </span>
      )
  }
}

function decisionIdChip(consigna: Consigna) {
  if (!consigna.decisionId) {
    return (
      <span data-testid="decision-id-chip" className="text-muted-foreground">
        —
      </span>
    )
  }
  return (
    <span
      data-testid="decision-id-chip"
      className="font-mono text-[10px] text-muted-foreground"
      title={consigna.decisionId}
    >
      {consigna.decisionId.slice(0, 8)}
    </span>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3.5 text-sm", className)}>{children}</td>
}

function fmt(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${suffix}`
}

export function ConsignaHistorial({ consignas, loteId, error }: ConsignaHistorialProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <History className="size-3.5" aria-hidden="true" />
          Historial
        </div>
        <CardTitle className="text-base font-semibold">Historial de consignas del lote</CardTitle>
        <CardDescription>
          {loteId
            ? "Pendiente = encolada para la Pi; Aplicada = confirmada por ack; Rechazada = no se pudo encolar."
            : "Seleccioná un lote para ver el historial de consignas asociadas."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!loteId ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold">Sin lote seleccionado</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              El historial de consignas se asocia a un lote. Elegí uno desde el formulario de
              consigna manual.
            </p>
          </div>
        ) : error && consignas.length === 0 ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold">Historial no disponible</p>
            <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
          </div>
        ) : consignas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold">Sin consignas</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              El lote todavía no tiene consignas registradas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left">
                  <Th>Fecha y hora</Th>
                  <Th>Origen</Th>
                  <Th>Objetivo temp / vel</Th>
                  <Th>Valores previos</Th>
                  <Th>Usuario</Th>
                  <Th>Resultado</Th>
                  <Th>Motivo</Th>
                </tr>
              </thead>
              <tbody>
                {consignas.map((consigna, index) => (
                  <tr
                    key={consigna.id || `consigna-${index}`}
                    className="border-b border-border/70 hover:bg-secondary/40"
                  >
                    <Td>
                      <div className="font-mono text-xs">{formatTime(consigna.creadaEn)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(consigna.creadaEn)}</div>
                    </Td>
                    <Td>
                      <span className="text-xs font-medium">{consigna.origen}</span>
                    </Td>
                    <Td>
                      <div>{fmt(consigna.temperaturaObjetivo, "°C")}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(consigna.velocidadCintaObjetivo, "m/s")}
                      </div>
                    </Td>
                    <Td>
                      <div>{fmt(consigna.temperaturaPrevia, "°C")}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(consigna.velocidadCintaPrevia, "m/s")}
                      </div>
                    </Td>
                    <Td className="text-muted-foreground">{consigna.usuario ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-0.5">
                        {resultadoBadge(consigna)}
                        {decisionIdChip(consigna)}
                      </div>
                    </Td>
                    <Td className="max-w-[12rem] truncate text-xs text-muted-foreground">
                      {consigna.motivoError ?? "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
