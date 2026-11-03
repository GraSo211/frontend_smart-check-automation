"use client"

import { useId, useState, type FormEvent } from "react"
import { AlertTriangle, Check, Flame, Gauge, Loader2, Package, Thermometer } from "lucide-react"
import { toast } from "sonner"
import { enviarConsignaManual } from "@/actions/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { validateConsignaInput, type LoteSector, type Producto } from "@/lib/production-data"

interface LoteOption {
  id: string
  label: string
  modo?: NonNullable<LoteSector["modo"]>
}

interface ConsignaFormProps {
  hornoId: string
  productos: Producto[]
  loteOptions: LoteOption[]
  loteId: string
  onLoteChange: (value: string) => void
  onSent?: (loteId: string) => void
  bloqueadaPorModo?: boolean
  motivoBloqueo?: string | null
}

const fmtNum = (value: number) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: 2 })

function productoLabel(producto: Producto): string {
  return `${producto.nombre} · ${fmtNum(producto.tempMin)}–${fmtNum(producto.tempMax)} °C · ${fmtNum(producto.velocidadCintaMin)}–${fmtNum(producto.velocidadCintaMax)} m/s`
}

function valoresPorDefecto(producto: Producto | undefined): { temp: string; vel: string } {
  if (!producto) return { temp: "", vel: "" }
  return {
    temp: String(producto.tempSetpoint ?? (producto.tempMin + producto.tempMax) / 2),
    vel: String(
      producto.velocidadCintaSetpoint ??
        (producto.velocidadCintaMin + producto.velocidadCintaMax) / 2,
    ),
  }
}

export function ConsignaForm({
  hornoId,
  productos,
  loteOptions,
  loteId,
  onLoteChange,
  onSent,
  bloqueadaPorModo = false,
  motivoBloqueo,
}: ConsignaFormProps) {
  const productoSelectId = useId()
  const tempInputId = useId()
  const velInputId = useId()
  const loteSelectId = useId()

  const primerProducto = productos[0]
  const [productoId, setProductoId] = useState(primerProducto?.id ?? "")
  const iniciales = valoresPorDefecto(primerProducto)
  const [temp, setTemp] = useState(iniciales.temp)
  const [vel, setVel] = useState(iniciales.vel)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const selectedProducto = productos.find((p) => p.id === productoId)

  const handleProductoChange = (value: string) => {
    setProductoId(value)
    const producto = productos.find((p) => p.id === value)
    const { temp: t, vel: v } = valoresPorDefecto(producto)
    setTemp(t)
    setVel(v)
    setFieldErrors({})
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProducto || isPending || bloqueadaPorModo) return

    const errors = validateConsignaInput(selectedProducto, {
      temperaturaObjetivo: temp,
      velocidadCintaObjetivo: vel,
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!selectedProducto || isPending || bloqueadaPorModo) return
    setIsPending(true)

    const result = await enviarConsignaManual({
      hornoId,
      productoId: selectedProducto.id,
      temperaturaObjetivo: parseFloat(temp),
      velocidadCintaObjetivo: parseFloat(vel),
      ...(loteId ? { loteId } : {}),
    })

    if (result.ok) {
      toast.success("Consigna enviada al horno.")
      setConfirmOpen(false)
    } else {
      const description = result.errors?.join(" · ") ?? "Ocurrió un error inesperado."
      toast.error("No se pudo enviar la consigna", { description })
    }

    // También en el rechazo el backend audita el intento (y puede forzar
    // CONTROL_MANUAL): refrescar historial y estado, no solo en éxito.
    onSent?.(loteId)
    setIsPending(false)
  }

  const disableCampos = productos.length === 0 || isPending || Boolean(bloqueadaPorModo)
  const disableLote = productos.length === 0 || isPending
  const selectedLoteLabel = loteOptions.find((l) => l.id === loteId)?.label ?? "Sin lote"

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <Flame className="size-3.5" aria-hidden="true" />
          Nueva consigna
        </div>
        <CardTitle className="text-base font-semibold">Consigna manual del horno</CardTitle>
        <CardDescription>
          Elegí producto, temperatura y velocidad de cinta. La consigna se envía al backend y la
          Raspberry la aplica en el próximo ciclo de control.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-5">
          {bloqueadaPorModo && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Consigna manual bloqueada</p>
                <p className="text-warning/80">
                  {motivoBloqueo ?? "El lote está en un modo automático."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={productoSelectId}>Producto</Label>
            <select
              id={productoSelectId}
              value={productoId}
              onChange={(event) => handleProductoChange(event.target.value)}
              disabled={disableCampos}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {productos.length === 0 ? (
                <option value="">Sin productos disponibles</option>
              ) : (
                productos.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {productoLabel(producto)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={tempInputId}>Temperatura objetivo</Label>
              <div className="relative">
                <Thermometer
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={tempInputId}
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={temp}
                  onChange={(event) => {
                    setTemp(event.target.value)
                    if (fieldErrors.temperaturaObjetivo) {
                      setFieldErrors((prev) => ({ ...prev, temperaturaObjetivo: "" }))
                    }
                  }}
                  disabled={disableCampos}
                  aria-invalid={fieldErrors.temperaturaObjetivo ? true : undefined}
                  aria-describedby={
                    fieldErrors.temperaturaObjetivo
                      ? `${tempInputId}-error`
                      : `${tempInputId}-hint`
                  }
                  className="pl-8"
                />
              </div>
              {fieldErrors.temperaturaObjetivo ? (
                <p id={`${tempInputId}-error`} className="text-xs text-destructive">
                  {fieldErrors.temperaturaObjetivo}
                </p>
              ) : selectedProducto ? (
                <p id={`${tempInputId}-hint`} className="text-xs text-muted-foreground">
                  Permitido: {fmtNum(selectedProducto.tempMin)}–{fmtNum(selectedProducto.tempMax)} °C
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={velInputId}>Velocidad de cinta objetivo</Label>
              <div className="relative">
                <Gauge
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={velInputId}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={vel}
                  onChange={(event) => {
                    setVel(event.target.value)
                    if (fieldErrors.velocidadCintaObjetivo) {
                      setFieldErrors((prev) => ({ ...prev, velocidadCintaObjetivo: "" }))
                    }
                  }}
                  disabled={disableCampos}
                  aria-invalid={fieldErrors.velocidadCintaObjetivo ? true : undefined}
                  aria-describedby={
                    fieldErrors.velocidadCintaObjetivo
                      ? `${velInputId}-error`
                      : `${velInputId}-hint`
                  }
                  className="pl-8"
                />
              </div>
              {fieldErrors.velocidadCintaObjetivo ? (
                <p id={`${velInputId}-error`} className="text-xs text-destructive">
                  {fieldErrors.velocidadCintaObjetivo}
                </p>
              ) : selectedProducto ? (
                <p id={`${velInputId}-hint`} className="text-xs text-muted-foreground">
                  Permitido: {fmtNum(selectedProducto.velocidadCintaMin)}–
                  {fmtNum(selectedProducto.velocidadCintaMax)} m/s
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={loteSelectId}>Lote</Label>
            <div className="relative">
              <Package
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <select
                id={loteSelectId}
                value={loteId}
                onChange={(event) => onLoteChange(event.target.value)}
                disabled={disableLote}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pl-8 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Sin lote</option>
                {loteOptions.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {lote.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/50">
          <Button
            type="submit"
            disabled={disableCampos || !selectedProducto}
            className="w-full gap-2 sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Enviando…
              </>
            ) : (
              <>
                <Flame className="size-4" aria-hidden="true" />
                Enviar consigna
              </>
            )}
          </Button>
        </CardFooter>
      </form>

      <Dialog open={confirmOpen} onOpenChange={(open) => !isPending && setConfirmOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle className="font-heading text-lg font-bold text-foreground">
              Confirmar envío
            </DialogTitle>
            <DialogDescription>
              Esta acción escribe directamente sobre el controlador físico del horno.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Producto:</span>{" "}
              <span className="font-medium text-foreground">
                {selectedProducto?.nombre ?? "—"}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Temperatura:</span>{" "}
              <span className="font-medium text-foreground">
                {fmtNum(parseFloat(temp || "0"))} °C
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Velocidad de cinta:</span>{" "}
              <span className="font-medium text-foreground">
                {fmtNum(parseFloat(vel || "0"))} m/s
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Lote destino:</span>{" "}
              <span className="font-medium text-foreground">{selectedLoteLabel}</span>
            </p>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={isPending} autoFocus>
                  Cancelar
                </Button>
              }
            />
            <Button type="button" onClick={handleConfirm} disabled={isPending || Boolean(bloqueadaPorModo)} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Enviando…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
