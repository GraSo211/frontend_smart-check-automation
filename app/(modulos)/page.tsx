import { HomeDashboard } from "@/components/dashboard-content"
import { getAllLotes, getAlertas, getHornoEstado } from "@/actions/api"
import { getSession } from "@/lib/auth"
import type { LoteSector } from "@/lib/production-data"

export const dynamic = "force-dynamic"

export default async function Page() {
  let runs: LoteSector[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null
  let alertasActivas: number | null = null
  let alertasError: string | null = null
  let temperaturaPromedio: number | null = null
  let temperaturaError: string | null = null

  const session = await getSession()
  const userRole = session?.rol ?? "Operario"

  const [lotesResult, alertasResult] = await Promise.allSettled([
    getAllLotes(),
    getAlertas({ estado: "ACTIVA" }),
  ])

  if (lotesResult.status === "fulfilled") {
    runs = lotesResult.value
    lastSyncAt = new Date().toISOString()
  } else {
    error = lotesResult.reason instanceof Error ? lotesResult.reason.message : "Error desconocido"
    runs = []
  }

  if (alertasResult.status === "fulfilled") {
    alertasActivas = alertasResult.value.length
  } else {
    alertasError = alertasResult.reason instanceof Error ? alertasResult.reason.message : "Error desconocido"
  }

  const sectoresAbiertos = Array.from(
    new Set(runs.filter((r) => r.estado === "ABIERTO").map((r) => r.sector_id)),
  )

  if (sectoresAbiertos.length > 0) {
    const hornoResultados = await Promise.allSettled(
      sectoresAbiertos.map((id) => getHornoEstado(id)),
    )
    const temperaturas: number[] = []
    let algunRechazado = false
    for (const res of hornoResultados) {
      if (res.status === "fulfilled" && res.value !== null && typeof res.value.temperatura === "number") {
        temperaturas.push(res.value.temperatura)
      } else if (res.status === "rejected") {
        algunRechazado = true
      }
    }
    if (temperaturas.length > 0) {
      temperaturaPromedio = temperaturas.reduce((a, b) => a + b, 0) / temperaturas.length
    } else if (algunRechazado) {
      temperaturaError = "No se pudo consultar la telemetría del horno."
    }
  }

  return (
    <main className="flex-1 bg-background">
      <HomeDashboard
        runs={runs}
        lastSyncAt={lastSyncAt}
        userRole={userRole}
        error={error}
        alertasActivas={alertasActivas}
        alertasError={alertasError}
        temperaturaPromedio={temperaturaPromedio}
        temperaturaError={temperaturaError}
      />
    </main>
  )
}
