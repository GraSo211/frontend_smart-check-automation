import type { Metadata } from "next"
import { Flame } from "lucide-react"
import {
  getConsignaHistorial,
  getHornoEstado,
  getLoteAbierto,
  getProductos,
  getSectores,
} from "@/actions/api"
import { ConsignaPanel } from "@/components/horno/consigna-panel"
import type { Consigna, HornoEstado, LoteSector, Producto, Sector } from "@/lib/production-data"

export const metadata: Metadata = {
  title: "Consigna Manual | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

interface LoteAbiertoOption extends LoteSector {
  sectorNombre: string
}

export default async function Page() {
  const hornoId = process.env.HORNO_ID ?? "horno-01"

  let productos: Producto[] = []
  let sectores: Sector[] = []
  let lotesAbiertos: LoteAbiertoOption[] = []
  let hornoEstado: HornoEstado | null = null
  let initialHistorial: Consigna[] = []
  const errors: {
    productos?: string
    sectores?: string
    horno?: string
    historial?: string
  } = {}

  try {
    productos = await getProductos()
  } catch (e) {
    errors.productos = e instanceof Error ? e.message : "No se pudieron consultar los productos."
  }

  try {
    sectores = await getSectores()
  } catch (e) {
    errors.sectores = e instanceof Error ? e.message : "No se pudieron consultar los sectores."
  }

  if (sectores.length > 0) {
    const resultados = await Promise.allSettled(
      sectores.map((sector) => getLoteAbierto(sector.id)),
    )
    lotesAbiertos = resultados
      .map((resultado, index) => {
        if (resultado.status !== "fulfilled" || !resultado.value) return null
        const lote = resultado.value
        const sector = sectores[index]
        return {
          ...lote,
          sectorNombre: sector?.nombre ?? lote.sector_id,
        }
      })
      .filter((lote): lote is LoteAbiertoOption => lote !== null)
  }

  try {
    hornoEstado = await getHornoEstado(hornoId)
  } catch (e) {
    errors.horno = e instanceof Error ? e.message : "No se pudo consultar el estado del horno."
  }

  const initialLoteId = lotesAbiertos[0]?.id ?? ""

  if (initialLoteId) {
    try {
      initialHistorial = await getConsignaHistorial(initialLoteId)
    } catch (e) {
      errors.historial =
        e instanceof Error ? e.message : "No se pudo consultar el historial de consignas."
    }
  }

  const loteOptions = lotesAbiertos.map((lote) => ({
    id: lote.id,
    label: `${lote.producto_nombre} · ${lote.sectorNombre}`,
    modo: lote.modo ?? "MANUAL",
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Consigna Manual
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Consigna manual del horno
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Enviá una consigna de temperatura y velocidad de cinta directamente al horno. El
            registro queda asociado al lote que elijas.
          </p>
        </header>

        {(errors.productos || errors.sectores) && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <Flame className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">No se pudieron cargar algunos datos</p>
              <p className="text-destructive/80">
                {errors.productos && errors.sectores
                  ? "Productos y sectores no disponibles."
                  : errors.productos ?? errors.sectores}
              </p>
            </div>
          </div>
        )}

        <ConsignaPanel
          hornoId={hornoId}
          productos={productos}
          loteOptions={loteOptions}
          initialLoteId={initialLoteId}
          initialHistorial={initialHistorial}
          initialHistorialError={errors.historial}
          hornoEstado={hornoEstado}
          hornoError={errors.horno}
        />
      </main>
    </div>
  )
}
