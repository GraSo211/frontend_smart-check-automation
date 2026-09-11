"use client"

import Image from "next/image"
import { Radio } from "lucide-react"
import { useMonitoring } from "@/components/monitoring-provider"
import type { SourceSync } from "@/lib/monitoring-types"

function syncText(source: SourceSync) {
  if (!source.lastConfirmedAt || source.freshness === "never") return { time: "—", age: "Sin confirmar" }
  const age = source.freshness === "stale" ? "Desactualizada" : "Actualizada"
  return { time: new Date(source.lastConfirmedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }), age }
}

// Bottom footer showing the timestamp of the last successful backend sync.
export function Footer() {
  const monitoring = useMonitoring()
  const lotes = syncText(monitoring.sync.lotes)
  const nodos = syncText(monitoring.sync.nodos)

  return (
    <footer className=" border-t border-sidebar-border bg-sidebar">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-4">
          <Image
            src="/sca/logo_horizontal.svg"
            alt="Smart-Check Automation"
            width={100}
            height={44}
            className="h-10 w-auto shrink-0"
          />
          <Image
            src="/fermar/Imagotipo - Versión Principal.webp"
            alt="Smart-Check Automation"
            width={100}
            height={44}
            className="h-10 w-auto shrink-0"
          />
          <p className="text-xs text-sidebar-foreground/65">
            Smart-Check Automation © 2026 | Desarrollado por SmarTeam – Sistema 
            de Control de Calidad Industrial.
          </p>
        </div>
        <div className="grid w-full gap-1 text-xs text-sidebar-foreground/65 sm:w-auto sm:min-w-64" title="Consulta o evento válido recibido">
          <p className="font-semibold text-sidebar-foreground/80">Última actualización confirmada</p>
          <p className="inline-flex items-center gap-1.5"><Radio className="size-3.5 text-sidebar-primary" aria-hidden="true" /><span>Lotes: <span className="font-mono text-sidebar-foreground">{lotes.time}</span> · {lotes.age}</span></p>
          <p className="inline-flex items-center gap-1.5"><Radio className="size-3.5 text-sidebar-primary" aria-hidden="true" /><span>Nodos: <span className="font-mono text-sidebar-foreground">{nodos.time}</span> · {nodos.age}</span></p>
          <p className="text-[10px]">Consulta o evento válido recibido</p>
        </div>
      </div>
    </footer>
  )
}
