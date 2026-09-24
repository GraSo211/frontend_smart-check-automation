import type { Metadata } from "next"
import { Activity, ShieldCheck } from "lucide-react"
import { getSectores } from "@/actions/api"
import type { Sector } from "@/lib/production-data"
import SupervisionView from "@/components/supervision/supervision-view"

export const metadata: Metadata = {
  title: "Supervisión en Vivo | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

export default async function Page() {
  // Los sectores resuelven el nombre mostrado en el selector de cámara. Si la
  // consulta falla, la supervisión sigue funcionando y el sector queda vacío.
  let sectores: Sector[] = []
  try {
    sectores = await getSectores()
  } catch {
    sectores = []
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10">
                <Activity className="size-3.5" aria-hidden="true" />
              </span>
              Centro de control
            </div>
            <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Supervisión en Vivo
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Observá la línea de producción en tiempo real y actuá antes de que una anomalía se convierta en un problema.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground shadow-sm sm:self-auto">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Monitoreo protegido
          </div>
        </header>

        <SupervisionView sectores={sectores} />
      </div>
    </main>
  )
}
