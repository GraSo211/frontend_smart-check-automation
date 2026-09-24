import type { Metadata } from "next"
import { Lock } from "lucide-react"
import { getDevices, getSectores } from "@/actions/api"
import { getSession, hasMinRole } from "@/lib/auth"
import type { Device } from "@/lib/devices-data"
import type { Sector } from "@/lib/production-data"
import { SectorManagement } from "@/components/sectores/sector-management"

export const metadata: Metadata = {
  title: "Sectores | Smart-Check Automation",
  description: "Administración de los sectores productivos y su relación con los nodos.",
}

export const dynamic = "force-dynamic"

export default async function Page() {
  const session = await getSession()
  // El backend es la autoridad; acá sólo ocultamos los controles de gestión.
  const canManage = session ? hasMinRole(session.rol, "Supervisor") : false

  let sectores: Sector[] = []
  let sectoresError: string | null = null
  try {
    sectores = await getSectores()
  } catch (error) {
    sectoresError = error instanceof Error ? error.message : "No se pudieron consultar los sectores."
  }

  // El conteo de dispositivos por sector es informativo: si la flota falla, la
  // página sigue mostrando los sectores sin bloquear el listado.
  let devices: Device[] = []
  try {
    devices = await getDevices()
  } catch {
    devices = []
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
                Sectores
              </div>
              <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Gestión de Sectores
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Administrá los sectores productivos y consultá cuántos nodos tiene asignado cada uno.
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

        <SectorManagement
          initialSectores={sectores}
          devices={devices}
          canManage={canManage}
          initialError={sectoresError}
        />
      </main>
    </div>
  )
}
