import { Activity, Factory } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

// Top application header with branding, enterprise badge and live system status.
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Factory className="size-6" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Smart-Check Automation
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Fermar S.A. – Panificadora Industrial
            </p>
          </div>
        </div>

        {/* Status indicators with a live IoT feed simulation and an enterprise badge. Quizas ocutarlo por ahora o agregar user para ver estado del os sitemas en tiempo real (2do sprint) */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Todos los Sistemas Funcionando
          </span>
          <span className="hidden items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border sm:inline-flex">
            <Activity className="size-3.5 text-primary" aria-hidden="true" />
            IoT Edge En Vivo
          </span>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
