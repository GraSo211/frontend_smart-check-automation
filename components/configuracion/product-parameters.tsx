"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import { Gauge, Scale, SlidersHorizontal, Thermometer, ShieldAlert, ShieldCheck, Lock, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateParametrosProducto } from "@/actions/api"
import { hasMinRole, type UserRole } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  validateParametros,
  type ParametroProducto,
  type ParametroProductoRequest,
} from "@/lib/parametros-producto"
import type { LucideIcon } from "lucide-react"

interface ProductParametersProps {
  producto: ParametroProducto | null
  userRole?: UserRole
}

type CampoDef = { key: keyof ParametroProductoRequest; label: string; unidad: string; min?: number }

const GRUPOS: { titulo: string; icono: LucideIcon; campos: CampoDef[] }[] = [
  {
    titulo: "Horno",
    icono: Thermometer,
    campos: [
      { key: "tempMin", label: "Temperatura mínima", unidad: "°C", min: 0 },
      { key: "tempMax", label: "Temperatura máxima", unidad: "°C", min: 0 },
    ],
  },
  {
    titulo: "Cinta",
    icono: Gauge,
    campos: [
      { key: "velocidadCintaMin", label: "Velocidad mínima", unidad: "m/s", min: 0 },
      { key: "velocidadCintaMax", label: "Velocidad máxima", unidad: "m/s", min: 0 },
    ],
  },
  {
    titulo: "Control de calidad",
    icono: Scale,
    campos: [
      { key: "pesoReferenciaKg", label: "Peso de referencia", unidad: "kg", min: 0.01 },
      { key: "toleranciaPesoPct", label: "Tolerancia de peso", unidad: "%", min: 0 },
      { key: "dimensionBaseCm", label: "Dimensión base", unidad: "cm", min: 0.01 },
      { key: "toleranciaDimensionCm", label: "Tolerancia de dimensión", unidad: "cm", min: 0 },
    ],
  },
]

function toFormString(producto: ParametroProducto): Record<string, string> {
  const base: Record<string, string> = {}
  for (const grupo of GRUPOS) {
    for (const campo of grupo.campos) {
      base[campo.key] = String(producto[campo.key])
    }
  }
  return base
}

function toRequest(values: Record<string, string>): ParametroProductoRequest {
  const request: Record<string, string | number> = {}
  for (const grupo of GRUPOS) {
    for (const campo of grupo.campos) {
      const raw = values[campo.key]
      request[campo.key] = raw === "" ? NaN : Number(raw)
    }
  }
  return request as unknown as ParametroProductoRequest
}

export default function ProductParameters({ producto, userRole = "Operario" }: ProductParametersProps) {
  if (!producto) return <EmptyState />

  return (
    <ParametersForm
      key={producto.id}
      producto={producto}
      userRole={userRole}
    />
  )
}

function ParametersForm({ producto, userRole }: { producto: ParametroProducto; userRole: UserRole }) {
  const [values, setValues] = useState<Record<string, string>>(() => toFormString(producto))
  const [pending, startTransition] = useTransition()

  // Solo Supervisores y Administradores pueden editar
  const canEdit = hasMinRole(userRole, "Supervisor")

  const request = useMemo(() => {
    const base = toRequest(values)
    return { ...base, productoId: producto.productoId }
  }, [values, producto.productoId])

  const errors = useMemo(() => validateParametros(request), [request])

  const setField = (key: keyof ParametroProductoRequest, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canEdit) return
    if (Object.keys(errors).length > 0) return

    startTransition(async () => {
      const result = await updateParametrosProducto(request)
      if (result.ok) {
        toast.success(`Parámetros actualizados para ${producto.productoNombre}`)
      } else {
        toast.error("No se pudieron actualizar los parámetros", {
          description: result.errors.join(" · "),
        })
      }
    })
  }

  const isDirty = GRUPOS.some((grupo) =>
    grupo.campos.some(
      (campo) => Number(values[campo.key]) !== Number(producto[campo.key]),
    ),
  )

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Parámetros del producto</CardTitle>
            <CardDescription>
              Valores recomendados para {producto.productoNombre}. Editalos y guardá para que las
              corridas usen los nuevos rangos.
            </CardDescription>
          </div>
          {!canEdit && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Lock className="size-3.5" aria-hidden="true" />
              Solo Lectura (Bloqueado)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {/* ─── Banner de Alerta RBAC ─── */}
        {!canEdit ? (
          <div
            role="alert"
            id="banner-acceso-denegado"
            className="flex items-start gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm"
          >
            <div className="rounded-lg bg-destructive/15 p-2 ring-1 ring-destructive/30">
              <ShieldAlert className="size-6 shrink-0 text-destructive" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base tracking-tight text-destructive flex items-center gap-2">
                Acceso Denegado — Restricción de Permisos (RBAC)
              </h3>
              <p className="text-sm leading-relaxed text-destructive/90">
                Estás conectado como <span className="font-bold underline">{userRole}</span>. No poseés los privilegios requeridos para modificar los rangos operativos ni guardar variables del horno. Todos los controles han sido deshabilitados por seguridad.
              </p>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300"
          >
            <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <p className="text-sm font-medium">
              Permisos Activos (<span className="font-bold">{userRole}</span>): Tenés autorización completa para modificar y ajustar las variables operativas del horno.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            {GRUPOS.map((grupo) => (
              <fieldset
                key={grupo.titulo}
                disabled={!canEdit}
                className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 transition-colors disabled:opacity-70"
              >
                <legend className="flex w-full items-center gap-2 px-1 text-sm font-semibold text-foreground">
                  <span className="flex size-6 items-center justify-center rounded-md bg-secondary/70 text-muted-foreground">
                    <grupo.icono className="size-3.5" aria-hidden="true" />
                  </span>
                  {grupo.titulo}
                  {!canEdit && (
                    <Lock className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                </legend>
                <div className="space-y-3">
                  {grupo.campos.map((campo) => (
                    <NumberField
                      key={campo.key}
                      id={`${producto.id}-${campo.key}`}
                      label={campo.label}
                      unidad={campo.unidad}
                      min={campo.min}
                      value={values[campo.key]}
                      error={errors[campo.key]}
                      disabled={!canEdit}
                      onChange={(value) => setField(campo.key, value)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {isDirty ? "Tenés cambios sin guardar" : "Sin cambios"}
            </span>
            <Button type="submit" disabled={pending || Object.keys(errors).length > 0 || !isDirty || !canEdit} className="gap-2">
              {pending ? "Guardando…" : canEdit ? (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  Guardar cambios
                </>
              ) : (
                <>
                  <Lock className="size-4" aria-hidden="true" />
                  Guardar Bloqueado
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function NumberField({
  id,
  label,
  unidad,
  min,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string
  label: string
  unidad: string
  min?: number
  value: string
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{unidad}</span>
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          step="any"
          min={min}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn("pr-10", disabled && "cursor-not-allowed")}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <SlidersHorizontal className="size-6 text-primary" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Sin producto seleccionado</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Elegí un producto de la grilla para ver y editar sus parámetros recomendados de horno y
            cinta.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
