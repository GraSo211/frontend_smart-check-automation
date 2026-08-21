import { DashboardContent } from "@/components/dashboard-content"
import { getAllProductionRuns } from "@/actions/api"
import { getSession } from "@/lib/auth"
import { PRODUCTION_RUNS, type ProductionRun } from "@/lib/production-data"

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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        dashboard
      </main>
    </div>
  )
}
