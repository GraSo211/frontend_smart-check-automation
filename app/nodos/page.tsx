import type { Metadata } from "next"
import { getDevices } from "@/actions/api"
import { DEVICES, type Device } from "@/lib/devices-data"
import DevicesState from "@/components/nodos/devices-state"

export const metadata: Metadata = {
  title: "Estado de los Nodos | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

export default async function Page() {
  let devices: Device[] = []
  let error: string | null = null
  let lastSyncAt: string | null = null

  try {
    const response = await getDevices()
    if (Array.isArray(response)) {
      devices = response
    } else if (response && Array.isArray((response as any).data)) {
      devices = (response as any).data
    } else {
      devices = DEVICES
    }

    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
    devices = DEVICES
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
