import { DashboardHeader } from "@/components/header"
import { KpiCards } from "@/components/kpi-cards"
import { SupervisionTable } from "@/components/supervision-table"
import { DashboardFooter } from "@/components/footer"
import { PRODUCTION_RUNS } from "@/lib/production-data"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-balance text-xl font-bold tracking-tight text-foreground">
            Supervisión de Producción
          </h2>
          <p className="text-sm text-muted-foreground">
            Información de telemetría y calidad en todas las líneas de producción.
          </p>
        </div>

        <div className="space-y-6">
          <KpiCards runs={PRODUCTION_RUNS} />
          <SupervisionTable />
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
