"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { deleteDispositivo, updateDispositivo } from "@/actions/api"
import type { Device } from "@/lib/devices-data"

interface DeviceActionsMenuProps {
  device: Device
  onDeleted?: (dispositivoId: string) => void
}

// Cuts React synthetic bubbling from the portaled popups (menu + dialogs) up to
// DeviceCard's role="button" handlers. The card listens for click and
// Enter/Space keydown on the whole card, and since synthetic events bubble
// through the component tree (not the DOM), Space typed in a dialog input
// would reach it, get swallowed by preventDefault and toggle the selection.
// base-ui keeps its own popup logic untouched: those handlers run in the same
// merged listener, right after this one, and don't check isPropagationStopped.
function stopPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

// Per-card actions (edit / delete) mounted in the device header. The card is a
// single role="button" container, so clicks and keyboard activation on the
// trigger stop propagation to avoid toggling the card selection.
export function DeviceActionsMenu({ device, onDeleted }: DeviceActionsMenuProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [nombre, setNombre] = useState(device.nombre)
  const [ubicacion, setUbicacion] = useState(device.ubicacion)
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const openEditDialog = () => {
    setNombre(device.nombre)
    setUbicacion(device.ubicacion)
    setNombreError(null)
    setEditOpen(true)
  }

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      setNombreError("El nombre es obligatorio.")
      return
    }
    setNombreError(null)

    startTransition(async () => {
      const result = await updateDispositivo({
        dispositivoId: device.dispositivoId,
        nombre: trimmedNombre,
        ubicacion: ubicacion.trim(),
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

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDispositivo(device.dispositivoId)

      if (result.ok) {
        toast.success("Dispositivo eliminado.")
        setDeleteOpen(false)
        onDeleted?.(device.dispositivoId)
        router.refresh()
      } else {
        toast.error("No se pudo eliminar el dispositivo", {
          description: result.errors.join(" · "),
        })
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <Button
              {...props}
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              aria-label={`Acciones de ${device.nombre}`}
              onClick={(e) => {
                e.stopPropagation()
                props.onClick?.(e)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                props.onKeyDown?.(e)
              }}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          )}
        />
        <DropdownMenuContent
          align="end"
          className="min-w-40"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
        >
          <DropdownMenuItem onClick={openEditDialog}>
            <Pencil aria-hidden="true" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={stopPropagation} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              <Pencil className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>Editar dispositivo</DialogTitle>
            <DialogDescription>Actualizá el nombre y la ubicación del nodo.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editar-dispositivo-nombre">Nombre</Label>
              <Input
                id="editar-dispositivo-nombre"
                value={nombre}
                placeholder="Nodo Horno 3"
                aria-invalid={nombreError ? true : undefined}
                aria-describedby={nombreError ? "editar-dispositivo-nombre-error" : undefined}
                onChange={(e) => {
                  setNombre(e.target.value)
                  if (nombreError) setNombreError(null)
                }}
              />
              {nombreError && (
                <p id="editar-dispositivo-nombre-error" className="mt-1 text-xs text-destructive">
                  {nombreError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editar-dispositivo-ubicacion">Ubicación</Label>
              <Input
                id="editar-dispositivo-ubicacion"
                value={ubicacion}
                placeholder="Línea A — Sector Horneado"
                onChange={(e) => setUbicacion(e.target.value)}
              />
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClick={stopPropagation} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>¿Eliminar dispositivo?</DialogTitle>
            <DialogDescription>
              Se eliminará {device.nombre} y todo su historial de telemetría. Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              }
            />
            <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
