
import { DashboardContent } from "@/components/lotes/dashboard-content"
import { getAllProductionRuns } from "@/actions/api"
import type { ProductionRun } from "@/lib/production-data"

export const dynamic = "force-dynamic"

export default async function Page() {
  let runs: ProductionRun[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  try {
    const response = await getAllProductionRuns()
    runs = response

    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    runs = []
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Lotes y Datos Históricos
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Supervisión de Producción
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Información de telemetría y calidad en todas las líneas de producción.
          </p>
        </header>

        <DashboardContent runs={runs} lastSyncAt={lastSyncAt} initialError={error} />
      </main>
    </div>
  )
}
