import type { Metadata } from "next"
import { Activity, Camera, CircleDot, ShieldCheck } from "lucide-react"
import LiveCamera from "@/components/supervision/live-camera"

export const metadata: Metadata = {
  title: "Supervisión en Vivo | Smart-Check Automation",
}

export default function Page() {
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <LiveCamera />
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CircleDot className="size-4 text-accent" aria-hidden="true" />
                Fuente de video
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Cámara principal · Planta de producción
              </p>
              <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <Camera className="size-3.5" aria-hidden="true" />
                Señal de baja latencia
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Estado operativo</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                La conexión se recupera automáticamente si la cámara pierde señal.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
