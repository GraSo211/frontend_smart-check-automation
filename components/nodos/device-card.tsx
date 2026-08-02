"use client"

import { Wifi, WifiOff, Cpu, MemoryStick, Thermometer, MapPin, Clock, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatLastSeen, formatRam, formatTemp } from "@/lib/format"
import type { Device } from "@/lib/devices-data"

// Maps each connection state to an icon and color treatment.
const STATUS_CONFIG: Record<
  Device["estado"],
  { label: string; icon: LucideIcon; chip: string; badge: string }
> = {
  online: {
    label: "Online",
    icon: Wifi,
    chip: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  offline: {
    label: "Offline",
    icon: WifiOff,
    chip: "bg-muted text-muted-foreground",
    badge: "bg-muted text-muted-foreground ring-border",
  },
}

const ID_PREVIEW_LENGTH = 12

interface DeviceCardProps {
  device: Device
  selected: boolean
  onSelect: (dispositivoId: string) => void
}

// Renders a selectable card summarizing a single node's state and last telemetry.
export function DeviceCard({ device, selected, onSelect }: DeviceCardProps) {
  const status = STATUS_CONFIG[device.estado]
  const StatusIcon = status.icon
  const { cpuPct, memRamDisponibleMb, tempChip, receivedAt } = device.ultimaMetrica
  const shortId =
    device.dispositivoId.length > ID_PREVIEW_LENGTH
      ? `${device.dispositivoId.slice(0, ID_PREVIEW_LENGTH)}…`
      : device.dispositivoId

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${device.nombre}, ${status.label}`}
      onClick={() => onSelect(device.dispositivoId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(device.dispositivoId)
        }
      }}
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
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
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
            status.badge,
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-semibold text-foreground">{device.nombre}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {device.ubicacion}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricTile
          icon={Cpu}
          label="CPU"
          value={`${cpuPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
        />
        <MetricTile icon={MemoryStick} label="RAM libre" value={formatRam(memRamDisponibleMb)} />
        <MetricTile icon={Thermometer} label="Chip" value={formatTemp(tempChip)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {formatLastSeen(receivedAt)}
        </span>
        <span className="truncate font-mono text-[11px] tracking-tight" title={device.dispositivoId}>
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
