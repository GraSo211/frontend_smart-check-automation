import type { Metadata } from "next"
import {
    getDevices,
    getDeviceHistoryPage,
    getLoteAbierto,
    getProductos,
    getSectores,
} from "@/actions/api"
import type { Device, SpecificDevice } from "@/lib/devices-data"
import type { LoteSector, Producto, Sector } from "@/lib/production-data"
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

// Tamaño de página fijo y chico: el dashboard de telemetría renderiza un chart
// por métrica, así que 50 muestras dan 2 pantallas completas sin saturar el
// SVG. Si hace falta más, el usuario abre el nodo en /nodos.
const TELEMETRY_PAGE_SIZE = 50

/**
 * Vista de la línea de producción: combina la salud del nodo Raspberry que
 * controla el horno con el semáforo de tolerancia del setpoint del lote
 * abierto contra el catálogo de productos.
 *
 * El sector se resuelve desde `?sector_id=...`; si no viene o no es válido,
 * se toma el primer sector disponible. Cuando no hay nodo ENTRADA_HORNO
 * asignado al sector, se renderiza un empty state con un link a /nodos.
 */
export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams
    const requestedSectorId = firstParam(params.sector_id)

    let sectores: Sector[] = []
    let devices: Device[] = []
    let productos: Producto[] = []
    const errores: string[] = []

    // Resiliencia: cada fetch se hace en paralelo y un fallo no cancela la
    // página entera — los errores se acumulan y la UI los muestra.
    const [sectoresResult, devicesResult, productosResult] = await Promise.allSettled([
        getSectores(),
        getDevices(),
        getProductos(),
    ])
    if (sectoresResult.status === "fulfilled") sectores = sectoresResult.value
    else errores.push(`Sectores: ${errMsg(sectoresResult.reason)}`)
    if (devicesResult.status === "fulfilled") devices = devicesResult.value
    else errores.push(`Dispositivos: ${errMsg(devicesResult.reason)}`)
    if (productosResult.status === "fulfilled") productos = productosResult.value
    else errores.push(`Productos: ${errMsg(productosResult.reason)}`)

    const selectedSectorId =
        requestedSectorId && sectores.some((s) => s.id === requestedSectorId)
            ? requestedSectorId
            : (sectores[0]?.id ?? null)

    const entradaDevice = selectedSectorId
        ? devices.find(
              (d) => d.sectorId === selectedSectorId && d.type === "ENTRADA_HORNO",
          ) ?? null
        : null

    let history: SpecificDevice[] = []
    let loteAbierto: LoteSector | null = null
    if (entradaDevice && selectedSectorId) {
        const [histResult, loteResult] = await Promise.allSettled([
            getDeviceHistoryPage(entradaDevice.dispositivoId, 1, TELEMETRY_PAGE_SIZE),
            getLoteAbierto(selectedSectorId),
        ])
        if (histResult.status === "fulfilled") {
            history = histResult.value.items
        } else {
            errores.push(`Historial: ${errMsg(histResult.reason)}`)
        }
        if (loteResult.status === "fulfilled") {
            loteAbierto = loteResult.value
        } else {
            errores.push(`Lote abierto: ${errMsg(loteResult.reason)}`)
        }
    }

    const producto = loteAbierto
        ? productos.find((p) => p.id === loteAbierto!.producto_id) ?? null
        : null

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                        <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
                        Línea de Producción
                    </div>
                    <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Monitoreo del horno y la cinta
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Telemetría en vivo del nodo ENTRADA_HORNO del sector seleccionado
                        y semáforo del setpoint del lote contra el rango permitido del
                        producto.
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
                    entradaDevice={entradaDevice}
                    history={history}
                    loteAbierto={loteAbierto}
                    producto={producto}
                />
            </main>
        </div>
    )
}

function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : "Error desconocido"
}