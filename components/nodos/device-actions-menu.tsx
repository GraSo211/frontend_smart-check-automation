"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Trash2, TriangleAlert } from "lucide-react"
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
import { SectorSelect } from "@/components/shared/sector-select"
import { deleteDispositivo, updateDispositivo } from "@/actions/api"
import type { Device } from "@/lib/devices-data"
import type { Sector } from "@/lib/production-data"
import { isWhepUrl } from "@/lib/camera-sources"

interface DeviceActionsMenuProps {
  device: Device
  /** Sectores disponibles para asignar al nodo. */
  sectores?: Sector[]
  /** Si la carga de sectores falló, se deshabilita la asignación para no perder la actual. */
  sectoresError?: string | null
}

// Cuts React synthetic bubbling from the portaled dialog up to DeviceCard's
// role="button" handlers. The card listens for click and Enter/Space keydown on
// the whole card, and since synthetic events bubble through the component tree
// (not the DOM), Space typed in a dialog input would reach it, get swallowed by
// preventDefault and toggle the selection. base-ui keeps its own popup logic
// untouched: those handlers run in the same merged listener, right after this
// one, and don't check isPropagationStopped.
function stopPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

// Per-card actions. The new backend no longer exposes the credential lifecycle
// (disable / enable / revoke / reprovision), so the remaining actions are the
// metadata edit (PUT /api/v1/dispositivos) and the destructive delete.
export function DeviceActionsMenu({
  device,
  sectores = [],
  sectoresError = null,
}: DeviceActionsMenuProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [sectorId, setSectorId] = useState(device.sectorId ?? "")
  const [whepUrl, setWhepUrl] = useState(device.whepUrl ?? "")
  const [whepError, setWhepError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Confirmación de borrado.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const deletingRef = useRef(false)

  const openEditDialog = () => {
    setSectorId(device.sectorId ?? "")
    setWhepUrl(device.whepUrl ?? "")
    setWhepError(null)
    setEditOpen(true)
  }

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmedWhepUrl = whepUrl.trim()
    if (!isWhepUrl(trimmedWhepUrl)) {
      setWhepError("Ingresá una URL http(s):// que termine en /whep.")
      return
    }
    setWhepError(null)

    startTransition(async () => {
      const result = await updateDispositivo({
        dispositivoId: device.dispositivoId,
        sectorId: sectorId === "" ? null : sectorId,
        whepUrl: trimmedWhepUrl || undefined,
      })

      if (result.ok) {
        toast.success("Dispositivo actualizado.")
        setEditOpen(false)
        router.refresh()
      } else {
        toast.error("No se pudo actualizar el dispositivo", {
          description: result.errors.join(" · "),
        })
      }
    })
  }

  const handleDelete = async () => {
    if (deletingRef.current) return
    deletingRef.current = true
    setIsDeleting(true)
    try {
      const result = await deleteDispositivo(device.dispositivoId)
      if (result.ok) {
        toast.success("Dispositivo dado de baja.")
        setDeleteOpen(false)
        router.refresh()
      } else {
        toast.error("No se pudo dar de baja el dispositivo", {
          description: result.errors.join(" · "),
        })
      }
    } catch (error) {
      toast.error("No se pudo dar de baja el dispositivo", {
        description: error instanceof Error ? error.message : "No se pudo dar de baja el dispositivo.",
      })
    } finally {
      deletingRef.current = false
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
        aria-label="Editar metadatos"
        title="Editar metadatos"
        onClick={(e) => {
          e.stopPropagation()
          openEditDialog()
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-destructive/15 hover:text-destructive"
        aria-label="Eliminar dispositivo"
        title="Eliminar dispositivo"
        onClick={(e) => {
          e.stopPropagation()
          setDeleteOpen(true)
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={stopPropagation} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              <Pencil className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>Editar dispositivo</DialogTitle>
            <DialogDescription>Actualizá el sector y la cámara del nodo.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editar-dispositivo-nombre">Nombre</Label>
              <Input
                id="editar-dispositivo-nombre"
                value={device.nombre}
                readOnly
                aria-describedby="editar-dispositivo-nombre-hint"
                className="cursor-default bg-muted"
              />
              <p id="editar-dispositivo-nombre-hint" className="mt-1 text-xs text-muted-foreground">
                El nombre solo se puede cambiar desde la propia Raspberry.
              </p>
            </div>

            <SectorSelect
              id="editar-dispositivo-sector"
              label="Sector"
              value={sectorId}
              onChange={setSectorId}
              sectores={sectores}
              allowEmpty
              emptyOptionLabel="Sin sector"
              disabled={Boolean(sectoresError)}
              error={sectoresError ? "No se pudieron cargar los sectores." : null}
              hint={
                !sectoresError && sectores.length === 0
                  ? "Todavía no hay sectores definidos."
                  : undefined
              }
            />

            <div className="space-y-1.5">
              <Label htmlFor="editar-dispositivo-whep">URL WHEP (cámara)</Label>
              <Input
                id="editar-dispositivo-whep"
                type="url"
                inputMode="url"
                value={whepUrl}
                placeholder="https://mediamtx.local/entrada/whep"
                aria-invalid={whepError ? true : undefined}
                aria-describedby={whepError ? "editar-dispositivo-whep-error" : "editar-dispositivo-whep-hint"}
                onChange={(e) => {
                  setWhepUrl(e.target.value)
                  if (whepError) setWhepError(null)
                }}
              />
              {whepError ? (
                <p id="editar-dispositivo-whep-error" className="mt-1 text-xs text-destructive">
                  {whepError}
                </p>
              ) : (
                <p id="editar-dispositivo-whep-hint" className="mt-1 text-xs text-muted-foreground">
                  Opcional. URL http(s):// que termina en /whep.
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                }
              />
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deletingRef.current) setDeleteOpen(false)
        }}
      >
        <DialogContent
          className="max-w-md"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
        >
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>Eliminar dispositivo</DialogTitle>
            <DialogDescription>
              {`¿Confirmás que querés eliminar el dispositivo "${device.nombre}" de la flota? Se revocará su credencial y se desasignará del sector; el historial de telemetría se conserva. El nodo deberá registrarse de nuevo.`}
            </DialogDescription>
          </DialogHeader>

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
                "Eliminar dispositivo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
