import type { Metadata } from "next"
import { getDevices } from "@/actions/api"
import { DEVICES, type Device } from "@/lib/devices-data"
import DevicesState from "@/components/nodos/devices-state"

export const metadata: Metadata = {
  title: "Estado de los Nodos | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

// Coerces an arbitrary backend payload into the safe Device shape. The API can
// return nodes without telemetry yet (e.g. freshly registered or offline ones),
// so missing ultimaMetrica is preserved as undefined instead of crashing
// downstream components like DeviceCard.
function normalizeDevice(raw: unknown): Device {
  const r = (raw ?? {}) as Record<string, unknown>
  const dispositivoId = typeof r.dispositivoId === "string" ? r.dispositivoId : ""
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
          tempChip: typeof metrica.tempChip === "number" ? metrica.tempChip : 0,
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
    if (Array.isArray(response)) {
      devices = response.map(normalizeDevice)
    } else if (response && Array.isArray((response as any).data)) {
      devices = (response as any).data.map(normalizeDevice)
    } else {
      devices = DEVICES.map(normalizeDevice)
    }

    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    devices = DEVICES.map(normalizeDevice)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-balance text-xl font-bold tracking-tight text-foreground">
            Estado de los Nodos
          </h1>
          <p className="text-sm text-muted-foreground">
            Diagnóstico de las Raspberry Pi y telemetría de cada dispositivo.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <DevicesState devices={devices} lastSyncAt={lastSyncAt} />
      </main>
    </div>
  )
}
