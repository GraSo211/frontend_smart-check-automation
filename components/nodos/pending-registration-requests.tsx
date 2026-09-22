"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Clock, Inbox, MonitorSmartphone, TriangleAlert, X } from "lucide-react"
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
import { approveRegistrationRequest, rejectRegistrationRequest } from "@/actions/api"
import { isRegistrationStale, registrationExpiryClock, registrationRemaining } from "@/lib/registration"
import type { RegistrationRequest } from "@/lib/devices-data"

interface PendingRegistrationRequestsProps {
  requests: RegistrationRequest[]
  /** Supervisor/Administrador pueden aprobar o rechazar; Operario es sólo lectura. */
  canManage: boolean
  /** Error de carga separado del listado vacío válido. */
  error?: string | null
  /** Reloj inyectable para pruebas deterministas. */
  now?: number
}

type Busy = { requestId: string; action: "approve" | "reject" } | null

const requestedAtFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
})

// La solicitud de registro la origina la propia Raspberry: el nodo pide
// identidad y un Supervisor/Admin la aprueba o rechaza desde acá. Hasta que se
// aprueba, no existe ningún dispositivo en el catálogo.
export function PendingRegistrationRequests({
  requests,
  canManage,
  error = null,
  now,
}: PendingRegistrationRequestsProps) {
  const router = useRouter()
  const [tick, setTick] = useState(() => now ?? Date.now())
  const [busy, setBusy] = useState<Busy>(null)
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (now !== undefined) return
    const id = window.setInterval(() => setTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [now])

  const current = now ?? tick
  // El panel muestra sólo lo accionable: aprobadas, rechazadas o vencidas ya no
  // esperan nada del Supervisor.
  const pendingRequests = requests.filter((request) => request.status === "PENDING")

  const handleApprove = (request: RegistrationRequest) => {
    if (pending || busy) return
    setBusy({ requestId: request.requestId, action: "approve" })
    startTransition(async () => {
      const result = await approveRegistrationRequest(request.requestId)
      if (result.ok) {
        toast.success(`Solicitud de ${request.hostname} aprobada.`, {
          description: `El nodo quedó registrado como ${result.data.deviceId}.`,
        })
        router.refresh()
      } else {
        toast.error("No se pudo aprobar la solicitud", { description: result.errors.join(" · ") })
      }
      setBusy(null)
    })
  }

  const handleReject = (request: RegistrationRequest) => {
    if (pending || busy) return
    setRejectTarget(null)
    setBusy({ requestId: request.requestId, action: "reject" })
    startTransition(async () => {
      const result = await rejectRegistrationRequest(request.requestId)
      if (result.ok) {
        toast.success(`Solicitud de ${request.hostname} rechazada.`)
        router.refresh()
      } else {
        toast.error("No se pudo rechazar la solicitud", { description: result.errors.join(" · ") })
      }
      setBusy(null)
    })
  }

  return (
    <>
      <section
        aria-labelledby="registros-heading"
        className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      >
        <header className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 id="registros-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <MonitorSmartphone className="size-4 text-primary" aria-hidden="true" />
              Solicitudes de registro pendientes
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Nodos que pidieron darse de alta y esperan la aprobación de un Supervisor o Administrador.
            </p>
          </div>
          {!error && pendingRequests.length > 0 && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {pendingRequests.length} {pendingRequests.length === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </header>

        {error ? (
          <div role="alert" className="flex items-start gap-2.5 px-5 py-6 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
              <Inbox className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">No hay solicitudes pendientes</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Cuando una Raspberry pida darse de alta, la vas a ver acá para aprobarla o rechazarla.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pendingRequests.map((request) => {
              const remaining = registrationRemaining(request.expiresAt, current)
              const stale = isRegistrationStale(request.expiresAt, current)
              const rowBusy = pending && busy?.requestId === request.requestId
              const approving = rowBusy && busy?.action === "approve"
              const rejecting = rowBusy && busy?.action === "reject"
              const requestedAt = new Date(request.createdAt)
              return (
                <li
                  key={request.requestId}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="break-words text-sm font-semibold text-foreground">{request.hostname}</span>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                      Solicitado el{" "}
                      {Number.isFinite(requestedAt.getTime()) ? requestedAtFormatter.format(requestedAt) : "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span
                      role="timer"
                      className={
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
                        (remaining.expired
                          ? "bg-destructive/10 text-destructive"
                          : stale
                            ? "bg-warning/10 text-warning"
                            : "bg-secondary/70 text-muted-foreground")
                      }
                    >
                      <Clock className="size-3.5" aria-hidden="true" />
                      {remaining.expired ? "Vencida" : remaining.label} · {registrationExpiryClock(request.expiresAt)} UTC
                    </span>
                    {canManage && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          aria-label={`Aprobar la solicitud de ${request.hostname}`}
                          onClick={() => handleApprove(request)}
                        >
                          <Check aria-hidden="true" />
                          {approving ? "Aprobando…" : "Aprobar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          aria-label={`Rechazar la solicitud de ${request.hostname}`}
                          onClick={() => setRejectTarget(request)}
                        >
                          <X aria-hidden="true" />
                          {rejecting ? "Rechazando…" : "Rechazar"}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {canManage && pendingRequests.length > 0 && (
          <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
            Al aprobar, la Raspberry queda registrada en la flota. Al rechazar, tiene que iniciar una solicitud nueva.
          </p>
        )}
      </section>

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRejectTarget(null)
        }}
      >
        <DialogContent>
          {rejectTarget && (
            <>
              <DialogHeader>
                <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <X className="size-5" aria-hidden="true" />
                </span>
                <DialogTitle>¿Rechazar la solicitud de {rejectTarget.hostname}?</DialogTitle>
                <DialogDescription>
                  La Raspberry no va a poder completar el alta y tendrá que iniciar una solicitud nueva. Esta acción
                  no se puede deshacer.
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
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  aria-label={`Confirmar el rechazo de ${rejectTarget.hostname}`}
                  onClick={() => handleReject(rejectTarget)}
                >
                  {pending && busy?.action === "reject" ? "Rechazando…" : "Rechazar solicitud"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
