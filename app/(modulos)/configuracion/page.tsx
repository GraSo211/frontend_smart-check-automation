import ProductGrid from "@/components/configuracion/product-card"
import ProductParameters from "@/components/configuracion/product-parameters"
import { ParametersHistory } from "@/components/configuracion/parameters-history"
import { getLotesPorProducto, getProductosConParametros } from "@/actions/api"
import { getSession } from "@/lib/auth"
import type { LotesPorProducto } from "@/lib/parametros-producto"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Parámetros de Configuración | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ productoId?: string | string[] }>
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const productoId = typeof params.productoId === "string" ? params.productoId : null

  const session = await getSession()
  const userRole = session?.rol ?? "Operario"

  let productos: Awaited<ReturnType<typeof getProductosConParametros>> = []
  let productosError: string | null = null
  try {
    productos = await getProductosConParametros()
  } catch (error) {
    productosError = error instanceof Error ? error.message : "No se pudieron consultar los productos."
  }
  const selectedProducto = productoId
    ? productos.find((p) => p.productoId === productoId) ?? null
    : null

  let lotes: LotesPorProducto | null = null
  let historialError: string | null = null
  if (selectedProducto) {
    try {
      lotes = await getLotesPorProducto(selectedProducto.productoId, 1, 100)
    } catch (error) {
      historialError = error instanceof Error ? error.message : "No se pudo consultar el historial."
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Configuración
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Parámetros de Configuración
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Seleccioná un producto para ver sus parámetros recomendados, editarlos, ajustar los rangos
            del horno y consultar el historial de corridas.
          </p>
        </header>

        <div className="space-y-10">
          <section aria-labelledby="productos-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 id="productos-heading" className="text-base font-semibold text-foreground">
                  Productos
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Elegí un producto para configurar sus parámetros.
                </p>
              </div>
              <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:inline">
                {productosError ? "—" : productos.length} {productosError ? "No disponible" : productos.length === 1 ? "producto" : "productos"}
              </span>
            </div>
            <ProductGrid productos={productos} selectedId={selectedProducto?.productoId ?? null} error={productosError} />
          </section>

          <section aria-label="Parámetros del producto">
            <ProductParameters producto={selectedProducto} userRole={userRole} />
          </section>

          <section aria-label="Historial de corridas">
            <ParametersHistory
              lotes={lotes?.items ?? []}
              productoNombre={selectedProducto?.productoNombre ?? ""}
              error={historialError}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
