"use client"

import Image from "next/image"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTriggerButton } from "@/components/layout/sidebar-trigger"
import { MonitoringStatus, availabilityLabel } from "@/components/layout/monitoring-status"
import { useMonitoring } from "@/components/monitoring-provider"

// ─── Componente ───────────────────────────────────────────────────────────────

// Encabezado principal con marca y estado de conexión no verificado.
export function Header() {
  const monitoring = useMonitoring()
  const overallLabel = availabilityLabel(monitoring.overall.availability)
  return (
    <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <SidebarTriggerButton />
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/20 p-1 shadow-sm">
            <Image
              src="/sca/logo_image_only.svg"
              alt="Smart-Check Automation"
              width={40}
              height={40}
              className="h-full w-full "
            />
          </div>
          <Image
            src="/sca/logo_title.svg"
            alt="Smart-Check Automation"
            width={120}
            height={42}
            className="h-10 w-auto"
          />


        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2.5" role="status" aria-live="polite" aria-label={`Estado de monitoreo: ${overallLabel}`}>
          <MonitoringStatus label="Monitoreo" status={monitoring.overall} />
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 text-[11px] text-sidebar-foreground/75" aria-label={`${monitoring.backend.detail}; ${monitoring.nodes.detail}; ${monitoring.camera.detail}`}>
            <MonitoringStatus label="API" status={monitoring.backend} />
            <MonitoringStatus label="Nodos" status={monitoring.nodes} />
            <MonitoringStatus label="Cámara" status={monitoring.camera} />
          </div>

          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
