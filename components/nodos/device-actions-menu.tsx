"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Power, PowerOff, RotateCcw, ShieldX, Ticket } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { EnrollmentCodePanel } from "@/components/nodos/enrollment-code-panel"
import {
  disableDispositivo,
  enableDispositivo,
  reprovisionDispositivo,
  revokeDispositivo,
  updateDispositivo,
} from "@/actions/api"
import { deviceAuthStatus, type Device, type EnrollmentInvitation } from "@/lib/devices-data"
import {
  LIFECYCLE_LABELS,
  lifecycleActionsFor,
  reprovisionConfirmation,
  revokeConfirmation,
  type LifecycleAction,
} from "@/lib/enrollment"
import { isWhepUrl } from "@/lib/camera-sources"

interface DeviceActionsMenuProps {
  device: Device
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

const ACTION_ICONS = {
  enable: Power,
  disable: PowerOff,
  revoke: ShieldX,
  reprovision: RotateCcw,
} as const

// Per-card actions: metadata edit plus credential lifecycle (disable / enable /
// revoke / reprovision). Revoke and reprovision require an explicit
// confirmation because they invalidate the current credential immediately.
export function DeviceActionsMenu({ device }: DeviceActionsMenuProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [nombre, setNombre] = useState(device.nombre)
  const [ubicacion, setUbicacion] = useState(device.ubicacion)
  const [whepUrl, setWhepUrl] = useState(device.whepUrl ?? "")
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [whepError, setWhepError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null)
  const [issued, setIssued] = useState<EnrollmentInvitation | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const authStatus = deviceAuthStatus(device)
  const actions = lifecycleActionsFor(authStatus)
  const unavailable = pending || busy !== null

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

  // Lifecycle handlers. Each branch narrows its own action result so the
  // reprovision invitation and the device read object never mix.
  const runLifecycle = (action: LifecycleAction) => {
    if (unavailable) return
    setBusy(action)
    startTransition(async () => {
      try {
        if (action === "reprovision") {
          const result = await reprovisionDispositivo(device.dispositivoId)
          if (result.ok) {
            setIssued(result.data)
            setConfirmAction(null)
            toast.success("Reprovisión generada. Copiá el código ahora.")
            router.refresh()
          } else {
            toast.error("No se pudo reprovisionar el nodo", { description: result.errors.join(" · ") })
          }
          return
        }

        const result =
          action === "disable"
            ? await disableDispositivo(device.dispositivoId)
            : action === "enable"
              ? await enableDispositivo(device.dispositivoId)
              : await revokeDispositivo(device.dispositivoId)

        if (result.ok) {
          toast.success(
            action === "disable"
              ? "Nodo deshabilitado. Su credencial quedó bloqueada."
              : action === "enable"
                ? "Nodo habilitado. Su credencial vuelve a estar activa."
                : "Credencial revocada. El nodo deberá reprovisionarse.",
          )
          setConfirmAction(null)
          router.refresh()
        } else {
          toast.error("No se pudo actualizar el ciclo de vida del nodo", {
            description: result.errors.join(" · "),
          })
        }
      } finally {
        setBusy(null)
      }
    })
  }

  const confirmation =
    confirmAction === "revoke"
      ? revokeConfirmation(device.nombre)
      : confirmAction === "reprovision"
        ? reprovisionConfirmation(device.nombre)
        : null

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
          className="min-w-44"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
        >
          <DropdownMenuItem onClick={openEditDialog}>
            <Pencil aria-hidden="true" />
            Editar metadatos
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action]
            const destructive = action === "revoke"
            return (
              <DropdownMenuItem
                key={action}
                variant={destructive ? "destructive" : "default"}
                disabled={unavailable}
                onClick={() => {
                  if (action === "revoke" || action === "reprovision") setConfirmAction(action)
                  else runLifecycle(action)
                }}
              >
                <Icon aria-hidden="true" />
                {LIFECYCLE_LABELS[action]}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

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

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmAction(null)
        }}
      >
        <DialogContent onClick={stopPropagation} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
          {confirmation && (
            <>
              <DialogHeader>
                <span
                  className={
                    confirmAction === "revoke"
                      ? "flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
                      : "flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  }
                >
                  {confirmAction === "revoke" ? (
                    <ShieldX className="size-5" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="size-5" aria-hidden="true" />
                  )}
                </span>
                <DialogTitle>{confirmation.title}</DialogTitle>
                <DialogDescription>{confirmation.description}</DialogDescription>
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
                  variant={confirmAction === "revoke" ? "destructive" : "default"}
                  disabled={unavailable}
                  onClick={() => confirmAction && runLifecycle(confirmAction)}
                >
                  {busy === confirmAction ? "Procesando…" : confirmation.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={issued !== null}
        onOpenChange={(next) => {
          if (!next) setIssued(null)
        }}
      >
        <DialogContent onClick={stopPropagation} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
          {issued && issued.code && (
            <>
              <DialogHeader>
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Ticket className="size-5" aria-hidden="true" />
                </span>
                <DialogTitle>Código de reprovisión</DialogTitle>
                <DialogDescription>
                  La credencial anterior ya quedó invalidada. Copiá este código ahora: se muestra una sola vez.
                </DialogDescription>
              </DialogHeader>
              <EnrollmentCodePanel code={issued.code} expiresAt={issued.expiresAt} nombre={issued.nombre} />
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
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
