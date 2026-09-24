import { DashboardContent } from "@/components/dashboard-content"
import { getAllLotes } from "@/actions/api"
import { getSession } from "@/lib/auth"
import type { LoteSector } from "@/lib/production-data"

export const dynamic = "force-dynamic"

export default async function Page() {
  let runs: LoteSector[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  const session = await getSession()
  const userRole = session?.rol ?? "Operario"

  try {
    const apiRuns = await getAllLotes()
    runs = apiRuns
    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    runs = []
  }

  return (
    <main className="flex-1 bg-background">
      <DashboardContent runs={runs} lastSyncAt={lastSyncAt} userRole={userRole} error={error} />
    </main>
  )
}
