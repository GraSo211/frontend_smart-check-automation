import type { Metadata } from "next"
import { getDevices } from "@/actions/api"
import type { Device } from "@/lib/devices-data"
import DevicesState from "@/components/nodos/devices-state"
import CreateDeviceDialog from "@/components/nodos/create-device-dialog"

export const metadata: Metadata = {
  title: "Estado de los Nodos | Smart-Check Automation",
}

export const dynamic = "force-dynamic"


function normalizeDevice(raw: unknown): Device | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const dispositivoId = typeof r.dispositivoId === "string" ? r.dispositivoId : ""
  if (!dispositivoId) return null

  const nombre = typeof r.nombre === "string" ? r.nombre : (dispositivoId || "Nodo")
  const ubicacion = typeof r.ubicacion === "string" ? r.ubicacion : "—"
  const estado = r.estado === "online" ? "online" : "offline"
  const lastSeen = typeof r.lastSeen === "string" ? r.lastSeen : ""

  const metrica = r.ultimaMetrica as Record<string, unknown> | null | undefined
  const ultimaMetrica =
    metrica && typeof metrica === "object"
      ? {
          id: typeof metrica.id === "string" ? metrica.id : `metric-${dispositivoId}`,
          dispositivoId: typeof metrica.dispositivoId === "string" ? metrica.dispositivoId : dispositivoId,
          cpuPct: typeof metrica.cpuPct === "number" ? metrica.cpuPct : 0,
          memRamDisponibleMb: typeof metrica.memRamDisponibleMb === "number" ? metrica.memRamDisponibleMb : 0,
          memRamTotalMb: typeof metrica.memRamTotalMb === "number" ? metrica.memRamTotalMb : undefined,
          almacenamientoDisponibleMb: typeof metrica.almacenamientoDisponibleMb === "number" ? metrica.almacenamientoDisponibleMb : undefined,
          almacenamientoTotalMb: typeof metrica.almacenamientoTotalMb === "number" ? metrica.almacenamientoTotalMb : undefined,
          tempChip: typeof metrica.tempChip === "number" ? metrica.tempChip : 0,
          aiProcessorPct: typeof metrica.aiProcessorPct === "number" ? metrica.aiProcessorPct : 0,
          receivedAt: typeof metrica.receivedAt === "string" ? metrica.receivedAt : "",
        }
      : undefined

  return { dispositivoId, nombre, ubicacion, estado, ultimaMetrica, lastSeen }
}

export default async function Page() {
  let devices: Device[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  try {
    const response = await getDevices()
    const responseData = Array.isArray(response)
      ? response
      : Array.isArray((response as unknown as Record<string, unknown>).data)
        ? ((response as unknown as Record<string, unknown>).data as unknown[])
        : null

    if (!responseData) {
      throw new Error("La API de dispositivos devolvió una respuesta inválida.")
    }

    devices = responseData
      .map(normalizeDevice)
      .filter((device): device is Device => device !== null)

    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
                Nodos
              </div>
              <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Estado de los Nodos
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Diagnóstico de las Raspberry Pi y telemetría de cada dispositivo.
              </p>
            </div>
            <CreateDeviceDialog />
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm"
          >
            {error}
          </div>
        )}

        <DevicesState devices={devices} lastSyncAt={lastSyncAt} />
      </main>
    </div>
  )
}
