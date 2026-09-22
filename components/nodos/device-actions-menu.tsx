"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
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
import { updateDispositivo } from "@/actions/api"
import type { Device } from "@/lib/devices-data"
import { isWhepUrl } from "@/lib/camera-sources"

interface DeviceActionsMenuProps {
  device: Device
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
// (disable / enable / revoke / reprovision), so the only remaining action is the
// metadata edit (PUT /api/v1/dispositivos).
export function DeviceActionsMenu({ device }: DeviceActionsMenuProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [nombre, setNombre] = useState(device.nombre)
  const [ubicacion, setUbicacion] = useState(device.ubicacion)
  const [whepUrl, setWhepUrl] = useState(device.whepUrl ?? "")
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [whepError, setWhepError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const openEditDialog = () => {
    setNombre(device.nombre)
    setUbicacion(device.ubicacion)
    setWhepUrl(device.whepUrl ?? "")
    setNombreError(null)
    setWhepError(null)
    setEditOpen(true)
  }

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      setNombreError("El nombre es obligatorio.")
      return
    }
    const trimmedWhepUrl = whepUrl.trim()
    if (!isWhepUrl(trimmedWhepUrl)) {
      setWhepError("Ingresá una URL http(s):// que termine en /whep.")
      return
    }
    setNombreError(null)
    setWhepError(null)

    startTransition(async () => {
      const result = await updateDispositivo({
        dispositivoId: device.dispositivoId,
        nombre: trimmedNombre,
        ubicacion: ubicacion.trim(),
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={stopPropagation} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              <Pencil className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>Editar dispositivo</DialogTitle>
            <DialogDescription>Actualizá el nombre, la ubicación y la cámara del nodo.</DialogDescription>
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
    </>
  )
}
