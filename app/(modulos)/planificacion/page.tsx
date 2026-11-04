import type { Metadata } from "next"
import { Lock } from "lucide-react"

import { getPlanificacionLista } from "@/actions/api"
import { getSession, hasMinRole } from "@/lib/auth"
import { PlanificacionView } from "@/components/planificacion/planificacion-view"
import { getDefaultReporteDateRange } from "@/lib/reportes"
import type {
  PlanificacionEnergiaItem,
  PlanificacionLista,
  PlanificacionParadaItem,
  PlanificacionPlanItem,
} from "@/lib/planificacion-types"

export const metadata: Metadata = {
  title: "Planificación | Smart-Check Automation",
}

export const dynamic = "force-dynamic"

export default async function Page() {
  const session = await getSession()
  const canAccess = session ? hasMinRole(session.rol, "Supervisor") : false

  const { desde, hasta } = getDefaultReporteDateRange()

  let plan: PlanificacionLista<PlanificacionPlanItem> = {
    total: 0,
    truncada: false,
    items: [],
  }
  let planError: string | undefined
  let paradas: PlanificacionLista<PlanificacionParadaItem> = {
    total: 0,
    truncada: false,
    items: [],
  }
  let paradasError: string | undefined
  let energia: PlanificacionLista<PlanificacionEnergiaItem> = {
    total: 0,
    truncada: false,
    items: [],
  }
  let energiaError: string | undefined

  if (canAccess) {
    const [planResult, paradasResult, energiaResult] =
      await Promise.allSettled([
        getPlanificacionLista("plan", {
          desde,
          hasta,
          limite: 100,
        }),
        getPlanificacionLista("paradas", {
          desde,
          hasta,
          limite: 100,
        }),
        getPlanificacionLista("energia", {
          desde,
          hasta,
          limite: 100,
        }),
      ])

    if (planResult.status === "fulfilled") {
      plan = planResult.value
    } else {
      planError =
        planResult.reason instanceof Error
          ? planResult.reason.message
          : "No se pudo cargar el plan de producción."
    }

    if (paradasResult.status === "fulfilled") {
      paradas = paradasResult.value
    } else {
      paradasError =
        paradasResult.reason instanceof Error
          ? paradasResult.reason.message
          : "No se pudieron cargar las paradas."
    }

    if (energiaResult.status === "fulfilled") {
      energia = energiaResult.value
    } else {
      energiaError =
        energiaResult.reason instanceof Error
          ? energiaResult.reason.message
          : "No se pudieron cargar las lecturas de energía."
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                <span
                  className="inline-block size-1.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
                Planificación
              </div>
              <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Importación de planificación
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Cargá el plan de producción, las paradas de línea y las lecturas
                de energía mediante archivos CSV. Las filas válidas se importan;
                las inválidas se listan para corrección.
              </p>
            </div>
            {!canAccess ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" />
                Requiere Supervisor o Administrador
              </span>
            ) : null}
          </div>
        </header>

        {canAccess ? (
          <PlanificacionView
            plan={plan}
            paradas={paradas}
            energia={energia}
            errors={{ plan: planError, paradas: paradasError, energia: energiaError }}
          />
        ) : (
          <div
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive"
          >
            <p className="font-medium">Acceso restringido</p>
            <p className="text-destructive/80">
              Se requiere rol Supervisor o Administrador para importar
              planificación.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
