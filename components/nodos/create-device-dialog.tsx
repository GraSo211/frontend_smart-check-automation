"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createDispositivo } from "@/actions/api"

// Button + modal to register a new Raspberry Pi node from the frontend.
// On success the backend returns the generated UUID, which must be flashed
// on the Pi (it's the dispositivoId it sends in its pings), so it's surfaced
// prominently in the success toast before refreshing the server-rendered grid.
export default function CreateDeviceDialog() {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [ubicacion, setUbicacion] = useState("")
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      setNombreError("El nombre es obligatorio.")
      return
    }
    setNombreError(null)

    startTransition(async () => {
      const result = await createDispositivo({
        nombre: trimmedNombre,
        ubicacion: ubicacion.trim(),
      })

      if (result.ok) {
        toast.success(
          `Dispositivo creado. ID: ${result.data.dispositivoId}. Configuralo en la Raspberry Pi: es el identificador que envía en sus pings.`,
        )
        setOpen(false)
        setNombre("")
        setUbicacion("")
        router.refresh()
      } else {
        toast.error("No se pudo crear el dispositivo", {
          description: result.errors.join(" · "),
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default">
            <Plus className="size-4" aria-hidden="true" />
            Agregar dispositivo
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle>Agregar dispositivo</DialogTitle>
          <DialogDescription>
            Registrá un nuevo nodo Raspberry Pi en el catálogo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dispositivo-nombre">Nombre</Label>
            <Input
              id="dispositivo-nombre"
              value={nombre}
              placeholder="Nodo Horno 3"
              aria-invalid={nombreError ? true : undefined}
              aria-describedby={nombreError ? "dispositivo-nombre-error" : undefined}
              onChange={(e) => {
                setNombre(e.target.value)
                if (nombreError) setNombreError(null)
              }}
            />
            {nombreError && (
              <p id="dispositivo-nombre-error" className="mt-1 text-xs text-destructive">
                {nombreError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispositivo-ubicacion">Ubicación</Label>
            <Input
              id="dispositivo-ubicacion"
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
              {pending ? "Creando…" : "Crear dispositivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
