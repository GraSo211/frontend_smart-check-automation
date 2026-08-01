import Image from "next/image"
import { Activity } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTriggerButton } from "@/components/layout/sidebar-trigger"

// Top application header with branding, enterprise badge and live system status.
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <SidebarTriggerButton />
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/20 p-1 shadow-sm">
            <Image
              src="/sca/logo_image_only.svg"
              alt="Smart-Check Automation"
              width={60}
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

        {/* Status indicators with a live IoT feed simulation and an enterprise badge. Quizas ocutarlo por ahora o agregar user para ver estado del os sitemas en tiempo real (2do sprint) */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-700">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Todos los Sistemas Funcionando
          </span>
          <span className="hidden items-center gap-1.5 rounded-full bg-sidebar-accent/15 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 ring-1 ring-inset ring-sidebar-border sm:inline-flex">
            <Activity className="size-3.5 text-sidebar-primary" aria-hidden="true" />
            IoT Edge En Vivo
          </span>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
