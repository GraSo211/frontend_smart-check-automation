"use client"

import { BrainCircuit, Wifi, WifiOff, Cpu, MemoryStick, Thermometer, Layers, Camera, Clock, SearchX, KeyRound, ShieldCheck, ShieldX, Ban, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatLastSeen, formatRam, formatTemp } from "@/lib/format"
import { AUTH_STATUS_LABELS, deviceAuthStatus, type AuthStatus, type Device } from "@/lib/devices-data"
import type { Sector } from "@/lib/production-data"
import { DeviceActionsMenu } from "@/components/nodos/device-actions-menu"

// Maps each connection state to an icon and color treatment.
const STATUS_CONFIG: Record<
  Device["estado"],
  { label: string; icon: LucideIcon; chip: string; badge: string }
> = {
  online: {
    label: "Online",
    icon: Wifi,
    chip: "bg-success/10 text-success",
    badge: "bg-success/10 text-success ring-success/30",
  },
  offline: {
    label: "Offline",
    icon: WifiOff,
    chip: "bg-muted text-muted-foreground",
    badge: "bg-muted text-muted-foreground ring-border",
  },
}

// Credential state is rendered separately from connectivity: a disabled node
// may still show a recent heartbeat but cannot authenticate to report.
const AUTH_CONFIG: Record<
  AuthStatus,
  { icon: LucideIcon; badge: string; hint: string | null }
> = {
  active: {
    icon: ShieldCheck,
    badge: "bg-success/10 text-success ring-success/30",
    hint: null,
  },
  unenrolled: {
    icon: KeyRound,
    badge: "bg-muted text-muted-foreground ring-border",
    hint: "Sin credencial: todavía no puede autenticarse.",
  },
  disabled: {
    icon: Ban,
    badge: "bg-warning/10 text-warning ring-warning/30",
    hint: "Credencial bloqueada: no puede autenticarse.",
  },
  revoked: {
    icon: ShieldX,
    badge: "bg-destructive/10 text-destructive ring-destructive/30",
    hint: "Credencial invalidada: no puede autenticarse.",
  },
}

const ID_PREVIEW_LENGTH = 12

interface DeviceCardProps {
  device: Device
  selected: boolean
  onSelect: (dispositivoId: string) => void
  /** Supervisor/Administrador ven acciones; Operario es sólo lectura. */
  canManage?: boolean
  /** Nombre del sector resuelto por el contenedor (mapa sectorId→nombre). */
  sectorName?: string | null
  /** Sectores disponibles, reenviados al menú de edición del nodo. */
  sectores?: Sector[]
  /** Error de carga de sectores: deshabilita la asignación en el menú. */
  sectoresError?: string | null
}

// Renders a selectable card summarizing a single node's state and last telemetry.
export function DeviceCard({
  device,
  selected,
  onSelect,
  canManage = false,
  sectorName = null,
  sectores = [],
  sectoresError = null,
}: DeviceCardProps) {
  const status = STATUS_CONFIG[device.estado]
  const StatusIcon = status.icon
  const authStatus = deviceAuthStatus(device)
  const auth = AUTH_CONFIG[authStatus]
  const AuthIcon = auth.icon
  const metrica = device.ultimaMetrica ?? null
  const shortId =
    device.dispositivoId.length > ID_PREVIEW_LENGTH
      ? `${device.dispositivoId.slice(0, ID_PREVIEW_LENGTH)}…`
      : device.dispositivoId

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${device.nombre}, ${status.label}, ${AUTH_STATUS_LABELS[authStatus]}`}
      onClick={() => onSelect(device.dispositivoId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(device.dispositivoId)
        }
      }}
      className={cn(
        "min-w-0 cursor-pointer rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            status.chip,
          )}
        >
          <StatusIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
              status.badge,
            )}
          >
            {status.label}
          </span>
          {canManage && (
            <DeviceActionsMenu
              device={device}
              sectores={sectores}
              sectoresError={sectoresError}
            />
          )}
        </div>
      </div>

      <div className="mt-3">
        <h3 className="break-words text-sm font-semibold text-foreground">{device.nombre}</h3>
        {sectorName ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            {sectorName}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            Sin sector
          </p>
        )}
        {device.whepUrl && (
          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={device.whepUrl}>
            <Camera className="size-3.5 shrink-0 text-info" aria-hidden="true" />
            <span className="truncate">Cámara configurada</span>
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
            auth.badge,
          )}
          title="Estado de la credencial del nodo (independiente de la conectividad)"
        >
          <AuthIcon className="size-3.5" aria-hidden="true" />
          {AUTH_STATUS_LABELS[authStatus]}
        </span>
        {auth.hint && <span className="min-w-0 text-xs text-muted-foreground">{auth.hint}</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrica ? (
          <>
            <MetricTile
              icon={Cpu}
              label="CPU"
              value={`${metrica.cpuPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
            />
            <MetricTile
              icon={MemoryStick}
              label="RAM libre"
              value={formatRam(metrica.memRamDisponibleMb)}
            />
            <MetricTile icon={Thermometer} label="Chip" value={formatTemp(metrica.tempChip)} />
            <MetricTile
              icon={BrainCircuit}
              label="IA"
              value={`${metrica.aiProcessorPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
            />
          </>
        ) : (
          <div className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-2 py-5 text-center sm:col-span-4">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              <SearchX className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">Sin telemetría</p>
            <p className="text-xs text-muted-foreground">Este nodo todavía no reportó datos.</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {metrica ? formatLastSeen(metrica.receivedAt) : "Sin actividad"}
        </span>
        <span className="max-w-[45%] truncate font-mono text-[11px] tracking-tight" title={device.dispositivoId}>
          {shortId}
        </span>
      </div>
    </div>
  )
}

// Compact metric tile for a single telemetry value.
function MetricTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-2 text-center">
      <Icon className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}
