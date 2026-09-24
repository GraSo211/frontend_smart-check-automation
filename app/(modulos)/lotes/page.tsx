import { DashboardContent } from "@/components/lotes/dashboard-content"
import { getAllLotes, getLoteAbierto, getSectores } from "@/actions/api"
import type { LoteSector, Sector } from "@/lib/production-data"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ sector_id?: string | string[] }>
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && raw !== "" ? raw : null
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const requestedSectorId = firstParam(params.sector_id)

  let sectores: Sector[] = []
  let sectoresError: string | null = null
  try {
    sectores = await getSectores()
  } catch (e) {
    sectoresError = e instanceof Error ? e.message : "Error desconocido"
    sectores = []
  }

  let runs: LoteSector[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  try {
    runs = await getAllLotes()
    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    runs = []
  }

  if (!error && sectoresError) error = sectoresError

  // A valid `sector_id` in the URL wins; otherwise default to the first sector.
  let selectedSectorId: string | null
  if (requestedSectorId && sectores.some((sector) => sector.id === requestedSectorId)) {
    selectedSectorId = requestedSectorId
  } else {
    selectedSectorId = sectores[0]?.id ?? null
  }

  // A missing/failed open lote is a valid state: the card falls back to the
  // live SSE-derived value, so this never blocks the page.
  let initialLoteAbierto: LoteSector | null = null
  if (selectedSectorId) {
    try {
      initialLoteAbierto = await getLoteAbierto(selectedSectorId)
    } catch {
      initialLoteAbierto = null
    }
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
            Supervisión por sector: lote abierto, conteos en tiempo real y el historial de producción.
          </p>
        </header>

        <DashboardContent
          runs={runs}
          lastSyncAt={lastSyncAt}
          initialError={error}
          sectores={sectores}
          selectedSectorId={selectedSectorId}
          initialLoteAbierto={initialLoteAbierto}
        />
      </main>
    </div>
  )
}
