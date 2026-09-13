"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Ticket, TriangleAlert } from "lucide-react"
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
import { EnrollmentCodePanel } from "@/components/nodos/enrollment-code-panel"
import { createEnrollmentInvitation } from "@/actions/api"
import { isWhepUrl } from "@/lib/camera-sources"
import type { EnrollmentInvitation } from "@/lib/devices-data"

// Emits a temporary single-use provisioning invitation. The one-time code is
// shown only inside this dialog, never persisted client-side, and cleared when
// the dialog closes. The Raspberry redeems the code to obtain its identity.
export default function EnrollmentInviteDialog() {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [ubicacion, setUbicacion] = useState("")
  const [whepUrl, setWhepUrl] = useState("")
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [whepError, setWhepError] = useState<string | null>(null)
  const [issued, setIssued] = useState<EnrollmentInvitation | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const reset = () => {
    setNombre("")
    setUbicacion("")
    setWhepUrl("")
    setNombreError(null)
    setWhepError(null)
    setIssued(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // The one-time code must not survive a close/reopen cycle.
    if (!next) reset()
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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
      const result = await createEnrollmentInvitation({
        nombre: trimmedNombre,
        ubicacion: ubicacion.trim(),
        whepUrl: trimmedWhepUrl || undefined,
      })

      if (result.ok) {
        setIssued(result.data)
        // Refresh the server payload so the pending invitation appears below.
        router.refresh()
      } else {
        toast.error("No se pudo crear la solicitud de enrolamiento", {
          description: result.errors.join(" · "),
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="default">
            <Ticket className="size-4" aria-hidden="true" />
            Nueva solicitud de enrolamiento
          </Button>
        }
      />
      <DialogContent>
        {issued ? (
          <>
            <DialogHeader>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Ticket className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle>Código de aprovisionamiento</DialogTitle>
              <DialogDescription>
                Copiá el código ahora: se muestra una sola vez y no se puede volver a consultar.
              </DialogDescription>
            </DialogHeader>

            {issued.code ? (
              <EnrollmentCodePanel code={issued.code} expiresAt={issued.expiresAt} nombre={issued.nombre} />
            ) : (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>La invitación se creó, pero la respuesta no incluyó el código. Generá una nueva solicitud.</p>
              </div>
            )}

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="default">
                    Listo, ya lo configuré
                  </Button>
                }
              />
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Ticket className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle>Nueva solicitud de enrolamiento</DialogTitle>
              <DialogDescription>
                Generá un código temporal de uso único. La Raspberry lo consume para obtener su identidad;
                hasta entonces no existe ningún dispositivo.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="enrolamiento-nombre">Nombre</Label>
                <Input
                  id="enrolamiento-nombre"
                  value={nombre}
                  placeholder="Nodo Horno 3"
                  aria-invalid={nombreError ? true : undefined}
                  aria-describedby={nombreError ? "enrolamiento-nombre-error" : undefined}
                  onChange={(e) => {
                    setNombre(e.target.value)
                    if (nombreError) setNombreError(null)
                  }}
                />
                {nombreError && (
                  <p id="enrolamiento-nombre-error" className="mt-1 text-xs text-destructive">
                    {nombreError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="enrolamiento-ubicacion">Ubicación</Label>
                <Input
                  id="enrolamiento-ubicacion"
                  value={ubicacion}
                  placeholder="Línea A — Sector Horneado"
                  onChange={(e) => setUbicacion(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="enrolamiento-whep">URL WHEP (cámara)</Label>
                <Input
                  id="enrolamiento-whep"
                  type="url"
                  inputMode="url"
                  value={whepUrl}
                  placeholder="https://mediamtx.local/entrada/whep"
                  aria-invalid={whepError ? true : undefined}
                  aria-describedby={whepError ? "enrolamiento-whep-error" : "enrolamiento-whep-hint"}
                  onChange={(e) => {
                    setWhepUrl(e.target.value)
                    if (whepError) setWhepError(null)
                  }}
                />
                {whepError ? (
                  <p id="enrolamiento-whep-error" className="mt-1 text-xs text-destructive">
                    {whepError}
                  </p>
                ) : (
                  <p id="enrolamiento-whep-hint" className="mt-1 text-xs text-muted-foreground">
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
                  {pending ? "Generando…" : "Generar código"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
