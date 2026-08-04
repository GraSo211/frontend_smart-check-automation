"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import { Gauge, Scale, SlidersHorizontal, Thermometer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateParametrosProducto } from "@/actions/api"
import {
  validateParametros,
  type ParametroProducto,
  type ParametroProductoRequest,
} from "@/lib/parametros-producto"
import type { LucideIcon } from "lucide-react"

interface ProductParametersProps {
  producto: ParametroProducto | null
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

export default function ProductParameters({ producto }: ProductParametersProps) {
  if (!producto) return <EmptyState />

  return (
    <ParametersForm
      key={producto.id}
      producto={producto}
    />
  )
}

function ParametersForm({ producto }: { producto: ParametroProducto }) {
  const [values, setValues] = useState<Record<string, string>>(() => toFormString(producto))
  const [pending, startTransition] = useTransition()

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
        <CardTitle>Parámetros del producto</CardTitle>
        <CardDescription>
          Valores recomendados para {producto.productoNombre}. Editalos y guardá para que las
          corridas usen los nuevos rangos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {GRUPOS.map((grupo) => (
              <fieldset
                key={grupo.titulo}
                className="space-y-4 rounded-xl border border-border bg-muted/20 p-4"
              >
                <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                  <span className="flex size-6 items-center justify-center rounded-md bg-secondary/70 text-muted-foreground">
                    <grupo.icono className="size-3.5" aria-hidden="true" />
                  </span>
                  {grupo.titulo}
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
            <Button type="submit" disabled={pending || Object.keys(errors).length > 0 || !isDirty}>
              {pending ? "Guardando…" : "Guardar cambios"}
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
  onChange,
}: {
  id: string
  label: string
  unidad: string
  min?: number
  value: string
  error?: string
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
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
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <SlidersHorizontal className="size-6 text-primary" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Sin producto seleccionado</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Seleccioná un producto de la grilla para ver y editar sus parámetros recomendados de
            horno y cinta.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
