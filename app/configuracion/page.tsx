import ProductGrid from "@/components/configuracion/product-card"
import ProductParameters from "@/components/configuracion/product-parameters"
import { ParametersHistory } from "@/components/configuracion/parameters-history"
import { getLotesPorProducto, getProductosConParametros } from "@/actions/api"
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

  const productos = await getProductosConParametros()
  const selectedProducto = productoId
    ? productos.find((p) => p.productoId === productoId) ?? null
    : null

  let lotes: LotesPorProducto | null = null
  if (selectedProducto) {
    lotes = await getLotesPorProducto(selectedProducto.productoId, 1, 100)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-balance text-xl font-bold tracking-tight text-foreground">
            Parámetros de Configuración
          </h1>
          <p className="text-sm text-muted-foreground">
            Seleccioná un producto para ver sus parámetros recomendados, editarlos y consultar el
            historial de corridas.
          </p>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="productos-heading">
            <div className="mb-3">
              <h2 id="productos-heading" className="text-sm font-semibold text-foreground">
                Productos
              </h2>
              <p className="text-xs text-muted-foreground">
                Elegí un producto para configurar sus parámetros.
              </p>
            </div>
            <ProductGrid productos={productos} selectedId={selectedProducto?.productoId ?? null} />
          </section>

          <section aria-label="Parámetros del producto">
            <ProductParameters producto={selectedProducto} />
          </section>

          <section aria-label="Historial de corridas">
            <ParametersHistory
              lotes={lotes?.items ?? []}
              productoNombre={selectedProducto?.productoNombre ?? ""}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
