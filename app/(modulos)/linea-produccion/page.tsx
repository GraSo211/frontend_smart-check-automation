import type { Metadata } from "next"
import {
    getAlertas,
    getLoteAbierto,
    getProductos,
    getSectores,
} from "@/actions/api"
import { getSession, hasMinRole } from "@/lib/auth"
import type { Alerta, LoteSector, Producto, Sector } from "@/lib/production-data"
import { LineaProduccionView } from "@/components/linea-produccion/linea-produccion-view"

export const metadata: Metadata = {
    title: "Línea de Producción | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

interface PageProps {
    searchParams: Promise<{ sector_id?: string | string[] }>
}

function firstParam(value: string | string[] | undefined): string | null {
    const raw = Array.isArray(value) ? value[0] : value
    return raw && raw !== "" ? raw : null
}

/**
 * Vista de control de la línea: modo de operación del lote abierto, setpoints
 * objetivo, KPIs de calidad y alertas del sector. La telemetría del hardware
 * (CPU, RAM, SoC) vive en /dispositivos y no se duplica acá.
 */
export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams
    const requestedSectorId = firstParam(params.sector_id)

    const session = await getSession()
    const canControl = session ? hasMinRole(session.rol, "Supervisor") : false

    let sectores: Sector[] = []
    let productos: Producto[] = []
    let alertas: Alerta[] = []
    const errores: string[] = []

    // Resiliencia: cada fetch se hace en paralelo y un fallo no cancela la
    // página entera — los errores se acumulan y la UI los muestra.
    const [sectoresResult, productosResult, alertasResult] = await Promise.allSettled([
        getSectores(),
        getProductos(),
        getAlertas({ estado: "ACTIVA" }),
    ])
    if (sectoresResult.status === "fulfilled") sectores = sectoresResult.value
    else errores.push(`Sectores: ${errMsg(sectoresResult.reason)}`)
    if (productosResult.status === "fulfilled") productos = productosResult.value
    else errores.push(`Productos: ${errMsg(productosResult.reason)}`)
    if (alertasResult.status === "fulfilled") alertas = alertasResult.value
    else errores.push(`Alertas: ${errMsg(alertasResult.reason)}`)

    const selectedSectorId =
        requestedSectorId && sectores.some((s) => s.id === requestedSectorId)
            ? requestedSectorId
            : (sectores[0]?.id ?? null)

    let loteAbierto: LoteSector | null = null
    if (selectedSectorId) {
        try {
            loteAbierto = await getLoteAbierto(selectedSectorId)
        } catch (e) {
            errores.push(`Lote abierto: ${errMsg(e)}`)
        }
    }

    const producto = loteAbierto
        ? productos.find((p) => p.id === loteAbierto!.producto_id) ?? null
        : null

    // Una alerta puede venir vinculada al sector o sólo al lote; aceptamos
    // ambas para no perder las que el backend no etiquetó con sector_id.
    const alertasSector = alertas.filter(
        (a) =>
            a.sector_id === selectedSectorId ||
            (loteAbierto !== null && a.lote_id === loteAbierto.id),
    )

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                        <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
                        Línea de Producción
                    </div>
                    <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Control y supervisión de la línea
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Modo de operación del lote abierto, setpoints objetivo contra
                        el rango del producto y alertas del sector. La telemetría del
                        dispositivo está en Dispositivos.
                    </p>
                </header>

                {errores.length > 0 && (
                    <div
                        role="alert"
                        className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground shadow-sm"
                    >
                        <p className="font-semibold">Algunos datos no están disponibles:</p>
                        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                            {errores.map((e) => (
                                <li key={e}>{e}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <LineaProduccionView
                    sectores={sectores}
                    selectedSectorId={selectedSectorId}
                    loteAbierto={loteAbierto}
                    producto={producto}
                    alertas={alertasSector}
                    canControl={canControl}
                />
            </main>
        </div>
    )
}

function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : "Error desconocido"
}
