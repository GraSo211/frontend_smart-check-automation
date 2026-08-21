import { DashboardContent } from "@/components/dashboard-content"
import { getAllProductionRuns } from "@/actions/api"
import { getSession } from "@/lib/auth"
import { PRODUCTION_RUNS, type ProductionRun } from "@/lib/production-data"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function Page() {
  let runs: ProductionRun[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  const session = await getSession()
  const userRole = session?.rol ?? "Operario"

  try {
    const apiRuns = await getAllProductionRuns()
    runs = apiRuns.length > 0 ? apiRuns : PRODUCTION_RUNS
    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    runs = PRODUCTION_RUNS
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Dashboard
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Dashboard de Producción
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Resumen de telemetría, calidad y rendimiento de las líneas de producción en tiempo
            real.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <DashboardContent runs={runs} lastSyncAt={lastSyncAt} />
      </main>
    </div>
  )
}
