
import { DashboardContent } from "@/components/dashboard-content"
import { getAllProductionRuns } from "@/actions/api"
import { PRODUCTION_RUNS, type ProductionRun } from "@/lib/production-data"

export default async function Page() {
  let runs: ProductionRun[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  try {
    const response = await getAllProductionRuns()
    if (Array.isArray(response)) {
      runs = response
    } else if (response && Array.isArray((response as any).data)) {
      runs = (response as any).data
    } else {
      runs = PRODUCTION_RUNS
    }

    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    runs = PRODUCTION_RUNS
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-balance text-xl font-bold tracking-tight text-foreground">
            Supervisión de Producción
          </h2>
          <p className="text-sm text-muted-foreground">
            Información de telemetría y calidad en todas las líneas de producción.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <DashboardContent runs={runs} lastSyncAt={lastSyncAt} />
      </main>
    </div>
  )
}
