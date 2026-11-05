"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatDate, formatWindow } from "@/lib/format"
import {
  buildPlanificacionItemUrl,
  type TipoImportacion,
} from "@/lib/planificacion"
import type {
  PlanificacionLista,
  PlanificacionParadaItem,
  PlanificacionPlanItem,
} from "@/lib/planificacion-types"

interface PlanificacionDatosProps {
  plan: PlanificacionLista<PlanificacionPlanItem>
  paradas: PlanificacionLista<PlanificacionParadaItem>
  errors: {
    plan?: string
    paradas?: string
  }
}

const TABS: { id: TipoImportacion; label: string }[] = [
  { id: "plan", label: "Plan de producción" },
  { id: "paradas", label: "Paradas" },
]

export function PlanificacionDatos({
  plan,
  paradas,
  errors,
}: PlanificacionDatosProps) {
  const [activeTab, setActiveTab] = useState<TipoImportacion>("plan")

  return (
    <section aria-label="Datos cargados">
      <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
        Datos cargados
      </h2>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Registros del período</CardTitle>
              <CardDescription>
                Últimos 30 días. Para editar una fila, reimportá el CSV; el
                import hace upsert.
              </CardDescription>
            </div>
            <div
              role="tablist"
              aria-label="Tipo de planificación"
              className="flex flex-wrap gap-2"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === "plan" ? (
              <PlanTable data={plan} error={errors.plan} />
            ) : null}
            {activeTab === "paradas" ? (
              <ParadasTable data={paradas} error={errors.paradas} />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function PlanTable({
  data,
  error,
}: {
  data: PlanificacionLista<PlanificacionPlanItem>
  error?: string
}) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function eliminar(id: string) {
    setDeletingId(id)
    try {
      const response = await fetch(buildPlanificacionItemUrl("plan", id), {
        method: "DELETE",
      })
      const body = (await response.json().catch(() => null)) as unknown
      if (!response.ok) {
        toast.error(
          extraerMensajeEliminacion(response.status, body) ||
            "No se pudo eliminar el registro.",
        )
        return
      }
      toast.success("Registro eliminado.")
      router.refresh()
    } catch {
      toast.error("Error de red al eliminar el registro.")
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  if (error) return <ErrorState message={error} />
  if (data.items.length === 0) return <EmptyState />

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Total: {" "}
        <span className="font-medium text-foreground">
          {data.total.toLocaleString("es-AR")}
        </span>
        {data.truncada ? " · Lista truncada a 100 registros" : null}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Plan de producción cargado</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <Th>Sector</Th>
              <Th>Producto</Th>
              <Th>Fecha</Th>
              <Th>Turno</Th>
              <Th>Inicio–Fin</Th>
              <Th className="text-right">kg plan</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border/70 last:border-0"
              >
                <Td>{item.sector_nombre || item.sector_id}</Td>
                <Td>{item.producto_nombre || item.producto_id}</Td>
                <Td>{formatDate(item.fecha)}</Td>
                <Td>{item.turno}</Td>
                <Td className="font-mono text-xs">
                  {formatWindow(item.inicio_at, item.fin_at)}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {item.kg_plan.toLocaleString("es-AR")}
                </Td>
                <Td className="text-right">
                  {confirmId === item.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">
                        ¿Eliminar?
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        onClick={() => eliminar(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? "..." : "Sí"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId === item.id}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(item.id)}
                      aria-label={`Eliminar registro del plan ${item.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Eliminar
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ParadasTable({
  data,
  error,
}: {
  data: PlanificacionLista<PlanificacionParadaItem>
  error?: string
}) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function eliminar(id: string) {
    setDeletingId(id)
    try {
      const response = await fetch(buildPlanificacionItemUrl("paradas", id), {
        method: "DELETE",
      })
      const body = (await response.json().catch(() => null)) as unknown
      if (!response.ok) {
        toast.error(
          extraerMensajeEliminacion(response.status, body) ||
            "No se pudo eliminar la parada.",
        )
        return
      }
      toast.success("Parada eliminada.")
      router.refresh()
    } catch {
      toast.error("Error de red al eliminar la parada.")
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  if (error) return <ErrorState message={error} />
  if (data.items.length === 0) return <EmptyState />

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Total: {" "}
        <span className="font-medium text-foreground">
          {data.total.toLocaleString("es-AR")}
        </span>
        {data.truncada ? " · Lista truncada a 100 registros" : null}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Paradas cargadas</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <Th>Sector</Th>
              <Th>Causa</Th>
              <Th>Tipo</Th>
              <Th>Inicio–Fin</Th>
              <Th>Notas</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border/70 last:border-0"
              >
                <Td>{item.sector_nombre || item.sector_id}</Td>
                <Td>{item.causa_codigo}</Td>
                <Td>{item.tipo}</Td>
                <Td className="font-mono text-xs">
                  {formatWindow(item.inicio_at, item.fin_at)}
                </Td>
                <Td className="max-w-xs truncate text-xs">
                  {item.notas ?? "—"}
                </Td>
                <Td className="text-right">
                  {confirmId === item.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">
                        ¿Eliminar?
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        onClick={() => eliminar(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? "..." : "Sí"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId === item.id}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(item.id)}
                      aria-label={`Eliminar parada ${item.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Eliminar
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        "py-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td
      className={cn(
        "py-2 pr-4 text-foreground",
        className,
      )}
    >
      {children}
    </td>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium text-foreground">Sin datos cargados</p>
      <p className="text-xs text-muted-foreground">
        No hay registros para el período seleccionado.
      </p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <p>{message}</p>
    </div>
  )
}

function extraerMensajeEliminacion(
  status: number,
  data: unknown,
): string | undefined {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message
  ) {
    return data.message
  }
  if (status === 401) return "Sesión expirada. Volvé a iniciar sesión."
  if (status === 403)
    return "No tenés permisos para eliminar este registro."
  if (status === 404) return "El registro no existe."
  if (status === 502) return "El backend no respondió."
}
