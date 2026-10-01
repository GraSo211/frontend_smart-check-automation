"use client"

import { useMemo, useRef, useState, type FormEvent } from "react"
import { Gauge, Loader2, Scale, Thermometer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  validateProducto,
  type Producto,
  type ProductoRequest,
} from "@/lib/production-data"
import type { LucideIcon } from "lucide-react"

type FieldKey = keyof ProductoRequest
type FormValues = Record<FieldKey, string>

interface FieldDef {
  key: FieldKey
  label: string
  unidad: string
  min?: number
  placeholder: string
  helper?: string
}

interface FieldGroup {
  titulo: string
  icono: LucideIcon
  campos: FieldDef[]
}

const GROUPS: FieldGroup[] = [
  {
    titulo: "Horno",
    icono: Thermometer,
    campos: [
      { key: "tempMin", label: "Temperatura mínima", unidad: "°C", min: 0, placeholder: "ej: 180" },
      { key: "tempMax", label: "Temperatura máxima", unidad: "°C", min: 0, placeholder: "ej: 220" },
    ],
  },
  {
    titulo: "Cinta",
    icono: Gauge,
    campos: [
      {
        key: "velocidadCintaMin",
        label: "Velocidad mínima",
        unidad: "m/s",
        min: 0,
        placeholder: "ej: 0,5",
        helper: "Rango de velocidad de la cinta transportadora.",
      },
      {
        key: "velocidadCintaMax",
        label: "Velocidad máxima",
        unidad: "m/s",
        min: 0,
        placeholder: "ej: 1,5",
        helper: "Rango de velocidad de la cinta transportadora.",
      },
    ],
  },
  {
    titulo: "Control de calidad",
    icono: Scale,
    campos: [
      { key: "pesoReferenciaKg", label: "Peso de referencia", unidad: "kg", min: 0, placeholder: "ej: 0,8" },
      {
        key: "toleranciaPesoPct",
        label: "Tolerancia de peso",
        unidad: "%",
        min: 0,
        placeholder: "ej: 5",
        helper: "Porcentaje de diferencia admitido respecto al peso de referencia.",
      },
      { key: "dimensionBaseCm", label: "Dimensión base", unidad: "cm", min: 0, placeholder: "ej: 30" },
      {
        key: "toleranciaDimensionCm",
        label: "Tolerancia de dimensión",
        unidad: "cm",
        min: 0,
        placeholder: "ej: 2",
        helper: "Diferencia en centímetros admitida respecto a la dimensión base.",
      },
    ],
  },
]

// Orden de foco/validación: nombre primero, luego los grupos tal como se ven.
const ORDERED_FIELDS: FieldKey[] = ["nombre", ...GROUPS.flatMap((g) => g.campos.map((c) => c.key))]

function toFormValues(initial?: Producto): FormValues {
  return {
    nombre: initial?.nombre ?? "",
    pesoReferenciaKg: initial ? String(initial.pesoReferenciaKg) : "",
    toleranciaPesoPct: initial ? String(initial.toleranciaPesoPct) : "",
    dimensionBaseCm: initial ? String(initial.dimensionBaseCm) : "",
    toleranciaDimensionCm: initial ? String(initial.toleranciaDimensionCm) : "",
    tempMin: initial ? String(initial.tempMin) : "",
    tempMax: initial ? String(initial.tempMax) : "",
    velocidadCintaMin: initial ? String(initial.velocidadCintaMin) : "",
    velocidadCintaMax: initial ? String(initial.velocidadCintaMax) : "",
  }
}

function toRequest(values: FormValues): ProductoRequest {
  const num = (raw: string) => (raw === "" ? Number.NaN : Number(raw))
  return {
    nombre: values.nombre.trim(),
    pesoReferenciaKg: num(values.pesoReferenciaKg),
    toleranciaPesoPct: num(values.toleranciaPesoPct),
    dimensionBaseCm: num(values.dimensionBaseCm),
    toleranciaDimensionCm: num(values.toleranciaDimensionCm),
    tempMin: num(values.tempMin),
    tempMax: num(values.tempMax),
    velocidadCintaMin: num(values.velocidadCintaMin),
    velocidadCintaMax: num(values.velocidadCintaMax),
  }
}

export interface ProductFormResult {
  ok: boolean
  errors?: string[]
}

export interface ProductFormProps {
  mode: "create" | "edit"
  initial?: Producto
  pending: boolean
  /** Bloquea todos los campos (p. ej. Operario en modo lectura). */
  disabled?: boolean
  onSubmit: (request: ProductoRequest) => Promise<ProductFormResult>
  onCancel?: () => void
  submitLabel?: string
  pendingLabel?: string
  /** Muestra el aviso de cambios sin guardar (modo edición con `initial`). */
  showDirtyHint?: boolean
  className?: string
}

// Formulario reutilizable de producto: nombre + los 8 parámetros de control.
// Valida contra las mismas reglas que el backend y expone los errores por campo.
export default function ProductForm({
  mode,
  initial,
  pending,
  disabled = false,
  onSubmit,
  onCancel,
  submitLabel,
  pendingLabel,
  showDirtyHint = false,
  className,
}: ProductFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(initial))
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const request = useMemo(() => toRequest(values), [values])
  const errors = useMemo(() => validateProducto(request), [request])
  const hasErrors = Object.keys(errors).length > 0

  const isDirty = useMemo(() => {
    if (!initial) return true
    return ORDERED_FIELDS.some((key) => {
      if (key === "nombre") return values.nombre.trim() !== initial.nombre
      return Number(values[key]) !== Number(initial[key])
    })
  }, [initial, values])

  const setField = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    if (serverErrors.length > 0) setServerErrors([])
  }

  const focusFirstError = (fieldErrors: Partial<Record<FieldKey, string>>) => {
    const first = ORDERED_FIELDS.find((key) => fieldErrors[key])
    if (!first) return
    const el = fieldRefs.current[first]
    el?.focus()
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disabled || pending) return

    if (hasErrors) {
      setTouched(Object.fromEntries(ORDERED_FIELDS.map((key) => [key, true])))
      focusFirstError(errors)
      return
    }

    setServerErrors([])
    const result = await onSubmit(request)
    if (!result.ok && result.errors?.length) {
      setServerErrors(result.errors)
    }
  }

  const isPristine = mode === "edit" && Boolean(initial) && !isDirty
  const resolvedSubmitLabel =
    submitLabel ?? (mode === "create" ? "Crear producto" : "Guardar cambios")
  const resolvedPendingLabel =
    pendingLabel ?? (mode === "create" ? "Creando…" : "Guardando…")

  return (
    <form onSubmit={handleSubmit} noValidate className={cn("space-y-5", className)}>
      {serverErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverErrors.length === 1 ? (
            <p>{serverErrors[0]}</p>
          ) : (
            <ul className="list-inside list-disc space-y-0.5">
              {serverErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="producto-nombre">Nombre</Label>
        <Input
          id="producto-nombre"
          ref={(el) => {
            fieldRefs.current.nombre = el
          }}
          value={values.nombre}
          placeholder="ej: Pan de campo"
          autoFocus={mode === "create"}
          disabled={disabled}
          aria-invalid={touched.nombre && errors.nombre ? true : undefined}
          aria-describedby={touched.nombre && errors.nombre ? "producto-nombre-error" : undefined}
          onChange={(e) => setField("nombre", e.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, nombre: true }))}
        />
        {touched.nombre && errors.nombre && (
          <p id="producto-nombre-error" className="text-xs text-destructive">
            {errors.nombre}
          </p>
        )}
      </div>

      {GROUPS.map((grupo) => (
        <fieldset
          key={grupo.titulo}
          disabled={disabled}
          className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 disabled:opacity-70"
        >
          <legend className="flex w-full items-center gap-2 px-1 text-sm font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-secondary/70 text-muted-foreground">
              <grupo.icono className="size-3.5" aria-hidden="true" />
            </span>
            {grupo.titulo}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {grupo.campos.map((campo) => (
              <NumberField
                key={campo.key}
                id={`producto-${campo.key}`}
                label={campo.label}
                unidad={campo.unidad}
                min={campo.min}
                placeholder={campo.placeholder}
                helper={campo.helper}
                value={values[campo.key]}
                error={touched[campo.key] ? errors[campo.key] : undefined}
                disabled={disabled}
                inputRef={(el) => {
                  fieldRefs.current[campo.key] = el
                }}
                onChange={(value) => setField(campo.key, value)}
                onBlur={() => setTouched((prev) => ({ ...prev, [campo.key]: true }))}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        {showDirtyHint && !disabled ? (
          <span className="text-xs text-muted-foreground">
            {isDirty ? "Tenés cambios sin guardar" : "Sin cambios"}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            disabled={disabled || pending || hasErrors || isPristine}
            className="gap-2"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {resolvedPendingLabel}
              </>
            ) : (
              resolvedSubmitLabel
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

function NumberField({
  id,
  label,
  unidad,
  min,
  placeholder,
  helper,
  value,
  error,
  disabled,
  inputRef,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  unidad: string
  min?: number
  placeholder: string
  helper?: string
  value: string
  error?: string
  disabled?: boolean
  inputRef?: (el: HTMLInputElement | null) => void
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{unidad}</span>
      </div>
      <Input
        id={id}
        ref={inputRef}
        type="number"
        step="any"
        min={min}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={cn(disabled && "cursor-not-allowed")}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="mt-1 text-xs text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  )
}
