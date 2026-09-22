import type { Metadata } from "next"
import { getDevices, getRegistrationRequests } from "@/actions/api"
import { getSession, hasMinRole } from "@/lib/auth"
import type { Device, RegistrationRequest } from "@/lib/devices-data"
import DevicesState from "@/components/nodos/devices-state"
import { Lock } from "lucide-react"

export const metadata: Metadata = {
  title: "Estado de los Nodos | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

export default async function Page() {
  const session = await getSession()
  // El backend es la autoridad; acá sólo ocultamos los controles de gestión.
  const canManage = session ? hasMinRole(session.rol, "Supervisor") : false

  let devices: Device[] = []
  let registrationRequests: RegistrationRequest[] = []
  let error: string | null = null
  let registrationRequestsError: string | null = null
  let lastSyncAt: string | null = null

  try {
    devices = await getDevices()

    lastSyncAt = new Date().toISOString()
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido"
  }

  // El backend restringe el listado a Supervisor/Admin: un Operario no debe
  // disparar una petición que ya sabemos que va a responder 403.
  if (canManage) {
    try {
      registrationRequests = await getRegistrationRequests()
    } catch (e) {
      registrationRequestsError =
        e instanceof Error ? e.message : "No se pudieron cargar las solicitudes de registro."
    }
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
                Diagnóstico de las Raspberry Pi y telemetría de cada dispositivo. La Raspberry pide el alta y un
                Supervisor o Administrador la aprueba desde este panel.
              </p>
            </div>
            {!canManage && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" />
                Sólo lectura · Operario
              </span>
            )}
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

        <DevicesState
          devices={devices}
          lastSyncAt={lastSyncAt}
          registrationRequests={registrationRequests}
          registrationRequestsError={registrationRequestsError}
          canManage={canManage}
        />
      </main>
    </div>
  )
}
