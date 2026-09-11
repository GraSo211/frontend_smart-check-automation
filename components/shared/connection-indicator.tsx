"use client"

import { cn } from "@/lib/utils"

export type ConnectionState = "connected" | "reconnecting" | "disconnected" | "unknown"
const labels: Record<ConnectionState, string> = { connected: "Conectado", reconnecting: "Reconectando", disconnected: "Desconectado", unknown: "Sin información" }

export function ConnectionIndicator({ state, label = "Conexión", detail, onRetry, disabled }: { state: ConnectionState; label?: string; detail?: string; onRetry?: () => void; disabled?: boolean }) {
  const unavailable = state !== "connected"
  return <span role="status" title={detail} className={cn("inline-flex flex-wrap items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset", state === "connected" ? "bg-success/10 text-success ring-success/20" : state === "reconnecting" ? "bg-warning/10 text-warning ring-warning/20" : state === "disconnected" ? "bg-destructive/10 text-destructive ring-destructive/20" : "bg-muted text-muted-foreground ring-border")}>
    <span className={cn("size-2 rounded-full", state === "connected" ? "bg-success" : state === "reconnecting" ? "animate-pulse bg-warning" : state === "disconnected" ? "bg-destructive" : "bg-muted-foreground/60")} aria-hidden="true" />
    <span>{label}: {labels[state]}</span>
    {unavailable && <span className="font-normal">Los datos pueden estar desactualizados.</span>}
    {unavailable && onRetry && <button type="button" onClick={onRetry} disabled={disabled} className="font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Reintentar</button>}
  </span>
}
