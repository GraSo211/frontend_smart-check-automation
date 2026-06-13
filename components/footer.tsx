"use client"

import { useEffect, useState } from "react"
import { Radio } from "lucide-react"

// Bottom footer with copyright and a simulated real-time IoT sync timestamp.
export function Footer() {
  const [lastSync, setLastSync] = useState<string>("")

  // Update the "last sync" clock every second to mimic a live IoT feed.
  useEffect(() => {
    const update = () =>
      setLastSync(
        new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      )
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer className="mt-10 border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
        <p className="text-xs text-muted-foreground">
          Smart-Check Automation © 2026 | Desarrollado por SmarTeam – Sistema 
          de Control de Calidad Industrial.
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Radio className="size-3.5 text-emerald-600" aria-hidden="true" />
          Última sincronización: <span className="font-mono text-foreground">{lastSync || "--:--:--"}</span>
          <span className="text-muted-foreground">· En tiempo real vía IoT Edge</span>
        </p>
      </div>
    </footer>
  )
}
