"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Clock, MapPin, Ticket, TicketX, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cancelEnrollment } from "@/actions/api"
import { enrollmentExpiryClock, enrollmentRemaining, isEnrollmentStale } from "@/lib/enrollment"
import type { EnrollmentInvitation } from "@/lib/devices-data"

interface PendingInvitationsProps {
  invitations: EnrollmentInvitation[]
  /** Supervisor/Administrador pueden cancelar; Operario es sólo lectura. */
  canManage: boolean
  /** Error de carga separado del listado vacío válido. */
  error?: string | null
  /** Reloj inyectable para pruebas deterministas. */
  now?: number
}

// Pending provisioning invitations are shown separately from the device fleet
// because they have no device UUID yet. Cancelling invalidates the one-time
// code on the backend.
export function PendingInvitations({ invitations, canManage, error = null, now }: PendingInvitationsProps) {
  const router = useRouter()
  const [tick, setTick] = useState(() => now ?? Date.now())
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (now !== undefined) return
    const id = window.setInterval(() => setTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [now])

  const current = now ?? tick

  const handleCancel = (invitation: EnrollmentInvitation) => {
    setCancellingId(invitation.enrollmentId)
    startTransition(async () => {
      const result = await cancelEnrollment(invitation.enrollmentId)
      if (result.ok) {
        toast.success(`Solicitud de ${invitation.nombre} cancelada.`)
        router.refresh()
      } else {
        toast.error("No se pudo cancelar la solicitud", { description: result.errors.join(" · ") })
      }
      setCancellingId(null)
    })
  }

  return (
    <section
      aria-labelledby="solicitudes-heading"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="solicitudes-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Ticket className="size-4 text-primary" aria-hidden="true" />
            Solicitudes de enrolamiento pendientes
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Invitaciones temporales esperando que la Raspberry las consuma. No son dispositivos todavía.
          </p>
        </div>
        {!error && invitations.length > 0 && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {invitations.length} {invitations.length === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 px-5 py-6 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
            <TicketX className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">No hay solicitudes pendientes</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Cuando generes una solicitud de enrolamiento, vas a verla acá hasta que se consuma o venza.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {invitations.map((invitation) => {
            const remaining = enrollmentRemaining(invitation.expiresAt, current)
            const stale = isEnrollmentStale(invitation.expiresAt, current)
            const busy = pending && cancellingId === invitation.enrollmentId
            return (
              <li
                key={invitation.enrollmentId}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-semibold text-foreground">{invitation.nombre}</span>
                    <span className="inline-flex items-center rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {invitation.dispositivoId ? "Reprovisión" : "Nuevo nodo"}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {invitation.ubicacion?.trim() ? invitation.ubicacion : "Sin ubicación"}
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
                    {remaining.expired ? "Vencida" : remaining.label} · {enrollmentExpiryClock(invitation.expiresAt)} UTC
                  </span>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={`Cancelar la solicitud de ${invitation.nombre}`}
                      onClick={() => handleCancel(invitation)}
                    >
                      <X aria-hidden="true" />
                      {busy ? "Cancelando…" : "Cancelar"}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canManage && invitations.length > 0 && (
        <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          Al cancelar, el código de uso único deja de ser válido de inmediato.
        </p>
      )}
    </section>
  )
}
