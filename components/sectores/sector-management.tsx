"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Boxes,
  Building2,
  Loader2,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSector, deleteSector, getSectores, updateSector } from "@/actions/api"
import type { Sector } from "@/lib/production-data"
import type { Device } from "@/lib/devices-data"

interface SectorManagementProps {
  initialSectores: Sector[]
  /** Flota completa, usada para contar cuántos dispositivos tiene cada sector. */
  devices?: Device[]
  /** Supervisor/Administrador pueden crear, editar y eliminar; Operario es sólo lectura. */
  canManage?: boolean
  initialError?: string | null
}

/**
 * Forma mínima de resultado que exponen las mutaciones de sector. Se modela de
 * forma estructural para no acoplar la UI al tipo exacto del action.
 */
type MutationResult = { ok: boolean; errors?: string[]; code?: string }

// Traducciones defensivas por código de error del backend. Si la acción ya
// devuelve un mensaje claro, se respeta ese mensaje.
const SECTOR_ERROR_BY_CODE: Record<string, string> = {
  sector_in_use: "No se puede eliminar el sector porque tiene lotes asociados.",
  sector_con_lotes: "No se puede eliminar el sector porque tiene lotes asociados.",
  sector_activo: "No se puede eliminar el sector porque todavía tiene un lote abierto.",
  sector_con_dispositivos: "No se puede eliminar el sector porque tiene dispositivos asignados.",
}

function actionErrorMessage(result: MutationResult, fallback: string): string {
  if (result.code && SECTOR_ERROR_BY_CODE[result.code]) return SECTOR_ERROR_BY_CODE[result.code]
  const joined = result.errors
    ?.map((message) => message.trim())
    .filter(Boolean)
    .join(" · ")
  return joined || fallback
}

export function SectorManagement({
  initialSectores,
  devices = [],
  canManage = false,
  initialError = null,
}: SectorManagementProps) {
  const [sectores, setSectores] = useState<Sector[]>(initialSectores)
  const [searchTerm, setSearchTerm] = useState("")
  const [loadError, setLoadError] = useState<string | null>(initialError)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Alta / edición comparten un único formulario en modal.
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Sector | null>(null)
  const [nombre, setNombre] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  // Confirmación de borrado.
  const [deleting, setDeleting] = useState<Sector | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const deletingRef = useRef(false)

  const router = useRouter()

  // Cantidad de dispositivos por sector.
  const deviceCountBySector = useMemo(() => {
    const counts = new Map<string, number>()
    for (const device of devices) {
      if (!device.sectorId) continue
      counts.set(device.sectorId, (counts.get(device.sectorId) ?? 0) + 1)
    }
    return counts
  }, [devices])

  const normalize = (value: string) => value.trim().toLocaleLowerCase("es-AR")

  const filteredSectores = useMemo(() => {
    const term = normalize(searchTerm)
    if (!term) return sectores
    return sectores.filter((sector) => normalize(sector.nombre).includes(term))
  }, [sectores, searchTerm])

  const totalSectores = sectores.length
  const sectoresConDispositivos = sectores.filter(
    (sector) => (deviceCountBySector.get(sector.id) ?? 0) > 0,
  ).length
  const dispositivosSinSector = devices.filter((device) => !device.sectorId).length

  const reload = async () => {
    const list = await getSectores()
    setSectores(list)
    setLoadError(null)
  }

  const openCreate = () => {
    setEditing(null)
    setNombre("")
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (sector: Sector) => {
    setEditing(sector)
    setNombre(sector.nombre)
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submittingRef.current) return

    const trimmed = nombre.trim()
    if (!trimmed) {
      setFormError("El nombre es obligatorio.")
      return
    }
    if (trimmed.length < 2) {
      setFormError("El nombre debe tener al menos 2 caracteres.")
      return
    }
    const duplicate = sectores.some(
      (sector) => sector.id !== editing?.id && normalize(sector.nombre) === normalize(trimmed),
    )
    if (duplicate) {
      setFormError("Ya existe un sector con ese nombre.")
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setFormError(null)
    try {
      const result: MutationResult = editing
        ? await updateSector({ id: editing.id, nombre: trimmed })
        : await createSector({ nombre: trimmed })

      if (result.ok) {
        toast.success(editing ? "Sector actualizado." : "Sector creado.")
        setFormOpen(false)
        setEditing(null)
        setNombre("")
        router.refresh()
        try {
          await reload()
        } catch {
          // La lista se actualizará con el próximo refresh de la página.
        }
      } else {
        setFormError(actionErrorMessage(result, "No se pudo guardar el sector."))
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo guardar el sector.")
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting || deletingRef.current) return
    deletingRef.current = true
    setIsDeleting(true)
    try {
      const result: MutationResult = await deleteSector(deleting.id)
      if (result.ok) {
        toast.success("Sector eliminado.")
        setDeleting(null)
        router.refresh()
        try {
          await reload()
        } catch {
          // El listado se reconciliará con el próximo refresh.
        }
      } else {
        toast.error("No se pudo eliminar el sector", {
          description: actionErrorMessage(result, "No se pudo eliminar el sector."),
        })
      }
    } catch (error) {
      toast.error("No se pudo eliminar el sector", {
        description: error instanceof Error ? error.message : "No se pudo eliminar el sector.",
      })
    } finally {
      deletingRef.current = false
      setIsDeleting(false)
    }
  }

  const handleRetry = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await reload()
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "No se pudieron consultar los sectores.",
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  const isLoadError = Boolean(loadError)
  const deletingCount = deleting ? deviceCountBySector.get(deleting.id) ?? 0 : 0

  return (
    <div className="space-y-8">
      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 ring-1 ring-destructive/30">
            <AlertCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="pt-1">{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Reintentando…" : "Reintentar"}
            </Button>
          </div>
        </div>
      )}

      {/* Resumen */}
      <section aria-labelledby="sectores-resumen-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="sectores-resumen-heading" className="text-base font-semibold text-foreground">
              Resumen
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sectores productivos y dispositivos asociados.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {isLoadError
              ? "— No disponible"
              : `${totalSectores} ${totalSectores === 1 ? "sector" : "sectores"}`}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Building2 className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Total Sectores</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {isLoadError ? "—" : totalSectores}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-info/15 text-info">
              <Boxes className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Con dispositivos</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {isLoadError ? "—" : sectoresConDispositivos}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <AlertCircle className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Dispositivos sin sector</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {isLoadError ? "—" : dispositivosSinSector}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Listado */}
      <section aria-labelledby="sectores-listado-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="sectores-listado-heading" className="text-base font-semibold text-foreground">
              Listado de Sectores
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {canManage
                ? "Creá, renombrá y eliminá los sectores productivos."
                : "Consulta de los sectores productivos y su cantidad de dispositivos."}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {isLoadError
              ? "— No disponible"
              : searchTerm
                ? `${filteredSectores.length} de ${totalSectores}`
                : `${totalSectores} ${totalSectores === 1 ? "sector" : "sectores"}`}
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-4 text-sm shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {canManage && (
            <Button
              type="button"
              onClick={openCreate}
              className="gap-2 rounded-xl shadow-md transition-shadow hover:shadow-lg"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Nuevo Sector</span>
            </Button>
          )}
        </div>

        {/* Vista móvil */}
        <div className="space-y-3 2xl:hidden" aria-label="Sectores en formato compacto">
          {isLoadError ? (
            <UnavailableSectores />
          ) : filteredSectores.length === 0 ? (
            <EmptySectores hasSearch={Boolean(searchTerm)} canManage={canManage} onCreate={openCreate} />
          ) : (
            filteredSectores.map((sector) => {
              const count = deviceCountBySector.get(sector.id) ?? 0
              return (
                <article key={sector.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30" aria-hidden="true">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-foreground">{sector.nombre}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {count === 1 ? "1 dispositivo" : `${count} dispositivos`}
                      </p>
                    </div>
                    <DeviceCountBadge count={count} />
                  </div>
                  {canManage && (
                    <div className="mt-4 flex gap-2 border-t border-border pt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(sector)}
                        className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(sector)}
                        className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Eliminar
                      </Button>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>

        {/* Tabla de escritorio */}
        <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm 2xl:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Sector</th>
                  <th className="px-6 py-4">Dispositivos</th>
                  {canManage && <th className="px-6 py-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadError || filteredSectores.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 3 : 2} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
                          <SearchX className="size-5" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium text-foreground">
                          {isLoadError ? "Sectores no disponibles" : searchTerm ? "Sin coincidencias" : "Sin sectores"}
                        </p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          {isLoadError
                            ? "No se puede mostrar el listado mientras la consulta falla."
                            : searchTerm
                              ? "No se encontraron sectores que coincidan con la búsqueda."
                              : canManage
                                ? "Creá el primer sector productivo para empezar."
                                : "No hay sectores para mostrar."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSectores.map((sector) => {
                    const count = deviceCountBySector.get(sector.id) ?? 0
                    return (
                      <tr key={sector.id} className="transition-colors hover:bg-secondary/40">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                              <Building2 className="size-4" aria-hidden="true" />
                            </div>
                            <p className="font-semibold text-foreground">{sector.nombre}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <DeviceCountBadge count={count} />
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(sector)}
                                className="size-8 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                                aria-label={`Editar ${sector.nombre}`}
                                title="Editar sector"
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleting(sector)}
                                className="size-8 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-destructive/15 hover:text-destructive"
                                aria-label={`Eliminar ${sector.nombre}`}
                                title="Eliminar sector"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal de alta / edición */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!submittingRef.current) setFormOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              {editing ? <Pencil className="size-5" aria-hidden="true" /> : <Building2 className="size-5" aria-hidden="true" />}
            </span>
            <DialogTitle className="font-heading text-lg font-bold text-foreground">
              {editing ? "Editar sector" : "Nuevo sector"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Actualizá el nombre del sector productivo."
                : "Definí el nombre del sector productivo."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sector-nombre">Nombre</Label>
              <Input
                id="sector-nombre"
                value={nombre}
                placeholder="ej: Horneado Línea A"
                autoFocus
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? "sector-nombre-error" : undefined}
                onChange={(event) => {
                  setNombre(event.target.value)
                  if (formError) setFormError(null)
                }}
              />
              {formError && (
                <p id="sector-nombre-error" role="alert" className="mt-1 text-xs text-destructive">
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancelar
                  </Button>
                }
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Guardando…
                  </>
                ) : editing ? (
                  "Guardar cambios"
                ) : (
                  "Crear sector"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !deletingRef.current) setDeleting(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle className="font-heading text-lg font-bold text-foreground">
              Eliminar sector
            </DialogTitle>
            <DialogDescription>
              {deleting
                ? `¿Confirmás que querés eliminar el sector "${deleting.nombre}"? Esta acción no se puede deshacer.`
                : "Confirmá la eliminación del sector."}
            </DialogDescription>
          </DialogHeader>

          {deletingCount > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Este sector tiene {deletingCount === 1 ? "1 dispositivo asignado" : `${deletingCount} dispositivos asignados`}. Si además tiene lotes asociados, el backend va a rechazar la operación.
              </span>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isDeleting} />}>
              Cancelar
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Eliminando…
                </>
              ) : (
                "Eliminar sector"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeviceCountBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border">
        Sin dispositivos
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-info/15 px-2.5 py-1 text-xs font-semibold text-info ring-1 ring-inset ring-info/40">
      <Boxes className="size-3.5" aria-hidden="true" />
      {count === 1 ? "1 dispositivo" : `${count} dispositivos`}
    </span>
  )
}

function EmptySectores({
  hasSearch,
  canManage,
  onCreate,
}: {
  hasSearch: boolean
  canManage: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
        <SearchX className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">
        {hasSearch ? "Sin coincidencias" : "Sin sectores"}
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {hasSearch
          ? "No se encontraron sectores que coincidan con la búsqueda."
          : canManage
            ? "Creá el primer sector productivo para empezar."
            : "No hay sectores para mostrar."}
      </p>
      {!hasSearch && canManage && (
        <Button type="button" size="sm" variant="outline" onClick={onCreate} className="mt-2 gap-1.5">
          <Plus className="size-3.5" aria-hidden="true" />
          Nuevo Sector
        </Button>
      )}
    </div>
  )
}

function UnavailableSectores() {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
        <AlertCircle className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">Sectores no disponibles</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        No se puede mostrar el listado mientras la consulta falla.
      </p>
    </div>
  )
}
