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

interface PageProps {
  searchParams: Promise<{ sector_id?: string | string[] }>
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && raw !== "" ? raw : null
}

interface LoteAbiertoOption extends LoteSector {
  sectorNombre: string
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const requested = firstParam(params.sector_id)

  let productos: Producto[] = []
  let sectores: Sector[] = []
  let loteAbierto: LoteAbiertoOption | null = null
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

  const selectedSectorId =
    requested && sectores.some((s) => s.id === requested)
      ? requested
      : (sectores[0]?.id ?? null)

  const selectedSector = sectores.find((s) => s.id === selectedSectorId)

  if (selectedSectorId) {
    try {
      const lote = await getLoteAbierto(selectedSectorId)
      if (lote) {
        loteAbierto = {
          ...lote,
          sectorNombre: selectedSector?.nombre ?? lote.sector_id,
        }
      }
    } catch {
      // El lote abierto es requerido en modo MANUAL: si falla, se deja sin
      // opción de lote y el formulario queda bloqueado.
    }
  }

  if (selectedSectorId) {
    try {
      hornoEstado = await getHornoEstado(selectedSectorId)
    } catch (e) {
      errors.horno = e instanceof Error ? e.message : "No se pudo consultar el estado del horno."
    }
  }

  const initialLoteId = loteAbierto?.id ?? ""

  if (initialLoteId) {
    try {
      initialHistorial = await getConsignaHistorial(initialLoteId)
    } catch (e) {
      errors.historial =
        e instanceof Error ? e.message : "No se pudo consultar el historial de consignas."
    }
  }

  const loteOptions = loteAbierto
    ? [
        {
          id: loteAbierto.id,
          label: `${loteAbierto.producto_nombre} · ${loteAbierto.sectorNombre}`,
          modo: loteAbierto.modo ?? "MANUAL",
        },
      ]
    : []

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
            Elegí un sector: cada uno tiene su horno con telemetría de la Pi. La consigna de
            temperatura y velocidad de cinta requiere un lote abierto en modo MANUAL; se encola
            para la Pi y queda asociada a ese lote.
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
          key={selectedSectorId ?? "sin-sector"}
          sectores={sectores}
          sectorId={selectedSectorId ?? ""}
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
