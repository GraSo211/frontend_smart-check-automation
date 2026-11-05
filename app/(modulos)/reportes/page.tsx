import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

import { getProductos, getReporteOEE, getReporteResumen, getSectores } from "@/actions/api"
import { ReportesDashboard } from "@/components/reportes/reportes-dashboard"
import { ReportesForm } from "@/components/reportes/reportes-form"
import type { Producto, Sector } from "@/lib/production-data"
import type { ReporteOEE } from "@/lib/oee-types"
import type { ReporteResumen } from "@/lib/reportes-types"
import { parseReporteSearchParams } from "@/lib/reportes"

export const metadata: Metadata = {
  title: "Reportes | SmartCheck Automation",
}

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    desde?: string | string[]
    hasta?: string | string[]
    sector_id?: string | string[]
    producto_id?: string | string[]
    turno?: string | string[]
  }>
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const appliedFilters = parseReporteSearchParams(params)

  let resumen: ReporteResumen | null = null
  let resumenError: string | null = null
  let oee: ReporteOEE | null = null
  let oeeError: string | null = null
  let sectores: Sector[] = []
  let sectoresError: string | null = null
  let productos: Producto[] = []
  let productosError: string | null = null

  const [resumenResult, oeeResult, sectoresResult, productosResult] =
    await Promise.allSettled([
      getReporteResumen({
        desde: appliedFilters.desde,
        hasta: appliedFilters.hasta,
        sectorId: appliedFilters.sectorId || null,
        productoId: appliedFilters.productoId || null,
        turno: appliedFilters.turno || null,
      }),
      getReporteOEE({
        desde: appliedFilters.desde,
        hasta: appliedFilters.hasta,
        sectorId: appliedFilters.sectorId || null,
      }),
      getSectores(),
      getProductos(),
    ])

  if (resumenResult.status === "fulfilled") {
    resumen = resumenResult.value
  } else {
    resumenError =
      resumenResult.reason instanceof Error
        ? resumenResult.reason.message
        : "No se pudo cargar el resumen del período."
  }

  if (oeeResult.status === "fulfilled") {
    oee = oeeResult.value
  } else {
    oeeError =
      oeeResult.reason instanceof Error
        ? oeeResult.reason.message
        : "No se pudo cargar el OEE del período."
  }

  if (sectoresResult.status === "fulfilled") {
    sectores = sectoresResult.value
  } else {
    sectoresError =
      sectoresResult.reason instanceof Error
        ? sectoresResult.reason.message
        : "No se pudieron cargar los sectores."
  }

  if (productosResult.status === "fulfilled") {
    productos = productosResult.value
  } else {
    productosError =
      productosResult.reason instanceof Error
        ? productosResult.reason.message
        : "No se pudieron cargar los productos."
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <span
              className="inline-block size-1.5 rounded-full bg-accent"
              aria-hidden="true"
            />
            Reportes
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Centro de reportes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Consultá el resumen operativo por período, sector, producto y turno.
            Descargá el detalle en CSV o JSON.
          </p>
        </header>

        <section
          id="filtros"
          aria-label="Filtros del reporte"
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <header className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Filtros
              </h2>
              <p className="text-xs text-muted-foreground">
                Período del {appliedFilters.desde} al {appliedFilters.hasta}{" "}
                (ART)
              </p>
            </div>
          </header>
          <div className="p-5">
            <ReportesForm
              key={`${appliedFilters.desde}|${appliedFilters.hasta}|${appliedFilters.sectorId}|${appliedFilters.productoId}|${appliedFilters.turno}`}
              appliedFilters={appliedFilters}
              sectores={sectores}
              productos={productos}
              catalogErrors={{
                sectores: sectoresError ?? undefined,
                productos: productosError ?? undefined,
              }}
              lotesTotal={resumen?.produccion.lotes_total ?? null}
            />
          </div>
        </section>

        {resumenError ? (
          <section className="mt-8">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive"
            >
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">No se pudo cargar el resumen</p>
                <p className="text-destructive/80">{resumenError}</p>
                <p className="mt-2 text-xs text-destructive/70">
                  Si el backend está en cold-start, esperá unos segundos y
                  recargá la página.
                </p>
              </div>
            </div>
          </section>
        ) : resumen ? (
          <div className="mt-8">
            <ReportesDashboard
              resumen={resumen}
              appliedFilters={appliedFilters}
              oee={oee}
              oeeError={oeeError}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}
