"use client"

import Image from "next/image"
import { useSyncExternalStore } from "react"
import { Radio } from "lucide-react"
import { getLastSync, subscribeToLastSync } from "@/lib/sync-store"

// Bottom footer showing the timestamp of the last successful backend sync.
export function Footer() {
  const lastSyncISO = useSyncExternalStore(
    subscribeToLastSync,
    getLastSync,
    () => null,
  )

  const lastSyncDisplay = lastSyncISO
    ? new Date(lastSyncISO).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : null

  return (
    <footer className=" border-t border-sidebar-border bg-sidebar">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Image
            src="/Imagotipo - Versión Principal.webp"
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
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-sidebar-foreground/65">
          <Radio className="size-3.5 text-sidebar-primary" aria-hidden="true" />
          Última sincronización: <span className="font-mono text-sidebar-foreground">{lastSyncDisplay ?? "--:--:--"}</span>

        </p>
      </div>
    </footer>
  )
}
