"use client"

import { useMemo, useRef, useState, type FormEvent } from "react"
import { Banknote, Gauge, Loader2, Scale, Target, Thermometer } from "lucide-react"
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
    titulo: "Costo de fabricación",
    icono: Banknote,
    campos: [{
      key: "costoFabricacionUnitarioArs",
      label: "Costo unitario de fabricación",
      unidad: "ARS / pieza",
      min: 0,
      placeholder: "ej: 125,50",
      helper: "Opcional, hasta 2 decimales. Vacío = sin configurar; 0 = costo cero. Cambiarlo recalcula la merma de los reportes al costo actual.",
    }],
  },
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
        key: "capacidadNominalKgH",
        label: "Capacidad nominal",
        unidad: "kg/h",
        min: 0,
        placeholder: "ej: 120",
        helper: "Opcional. Se usa para calcular Performance/OEE. Dejá en blanco si no aplica.",
      },
    ],
  },
]

// Setpoints opcionales: se agrupan aparte del resto de los parámetros.
const SETPOINTS: FieldDef[] = [
  { key: "tempSetpoint", label: "Temperatura objetivo", unidad: "°C", placeholder: "ej: 200" },
  { key: "velocidadCintaSetpoint", label: "Velocidad objetivo", unidad: "m/s", placeholder: "ej: 1,0" },
]

// Orden de foco/validación: nombre primero, luego los grupos tal como se ven.
const ORDERED_FIELDS: FieldKey[] = [
  "nombre",
  ...GROUPS.flatMap((g) => g.campos.map((c) => c.key)),
  ...SETPOINTS.map((c) => c.key),
]

function toFormValues(initial?: Producto): FormValues {
  return {
    nombre: initial?.nombre ?? "",
    costoFabricacionUnitarioArs: initial?.costoFabricacionUnitarioArs != null ? String(initial.costoFabricacionUnitarioArs) : "",
    pesoReferenciaKg: initial ? String(initial.pesoReferenciaKg) : "",
    tempMin: initial ? String(initial.tempMin) : "",
    tempMax: initial ? String(initial.tempMax) : "",
    velocidadCintaMin: initial ? String(initial.velocidadCintaMin) : "",
    velocidadCintaMax: initial ? String(initial.velocidadCintaMax) : "",
    capacidadNominalKgH:
      initial?.capacidadNominalKgH != null ? String(initial.capacidadNominalKgH) : "",
    tempSetpoint: initial?.tempSetpoint != null ? String(initial.tempSetpoint) : "",
    velocidadCintaSetpoint:
      initial?.velocidadCintaSetpoint != null ? String(initial.velocidadCintaSetpoint) : "",
  }
}

export function toRequest(values: FormValues): ProductoRequest {
  const num = (raw: string) => (raw === "" ? Number.NaN : Number(raw))
  // Vacío o no numérico -> se omite del body (no se manda null ni 0).
  const optionalNum = (raw: string): number | undefined => {
    const trimmed = raw.trim()
    return trimmed === "" ? undefined : Number(trimmed)
  }

  const request: ProductoRequest = {
    nombre: values.nombre.trim(),
    costoFabricacionUnitarioArs: optionalNum(values.costoFabricacionUnitarioArs ?? "") ?? null,
    pesoReferenciaKg: num(values.pesoReferenciaKg),
    tempMin: num(values.tempMin),
    tempMax: num(values.tempMax),
    velocidadCintaMin: num(values.velocidadCintaMin),
    velocidadCintaMax: num(values.velocidadCintaMax),
    // La capacidad nominal siempre viaja: vacío = sin capacidad (null).
    capacidadNominalKgH: optionalNum(values.capacidadNominalKgH) ?? null,
  }

  const tempSetpoint = optionalNum(values.tempSetpoint)
  if (tempSetpoint !== undefined) request.tempSetpoint = tempSetpoint
  const velocidadCintaSetpoint = optionalNum(values.velocidadCintaSetpoint)
  if (velocidadCintaSetpoint !== undefined) request.velocidadCintaSetpoint = velocidadCintaSetpoint

  return request
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
  /**
   * Errores por campo devueltos por el backend (422). Tienen prioridad sobre la
   * validación de cliente y se mantienen visibles hasta que el contenedor los
   * limpie.
   */
  serverErrors?: Record<string, string>
  className?: string
}

// Formulario reutilizable de producto: nombre + los parámetros de control.
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
  serverErrors,
  className,
}: ProductFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(initial))
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [formErrors, setFormErrors] = useState<string[]>([])
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const request = useMemo(() => toRequest(values), [values])
  const errors = useMemo(() => validateProducto(request), [request])
  const hasErrors = Object.keys(errors).length > 0

  const isDirty = useMemo(() => {
    if (!initial) return true
    return ORDERED_FIELDS.some((key) => {
      if (key === "nombre") return values.nombre.trim() !== initial.nombre
      if (key === "tempSetpoint" || key === "velocidadCintaSetpoint") {
        const current = values[key].trim() === "" ? undefined : Number(values[key])
        const base = initial[key] == null ? undefined : Number(initial[key])
        return current !== base
      }
      return Number(values[key]) !== Number(initial[key])
    })
  }, [initial, values])

  // Prioridad del servidor: si hay un error de campo del backend, se muestra ese
  // por encima de la validación de cliente (que además sólo aparece tras tocar
  // el campo). Cuando el servidor ya marca el campo, se oculta el de cliente.
  const serverError = (key: FieldKey) => serverErrors?.[key]
  const clientError = (key: FieldKey) =>
    serverErrors?.[key] ? undefined : touched[key] ? errors[key] : undefined

  const setField = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    // Los errores del servidor NO se limpian acá (sobreviven al primer edit);
    // los de cliente se recalculan solos. El aviso general sí se limpia.
    if (formErrors.length > 0) setFormErrors([])
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

    setFormErrors([])
    const result = await onSubmit(request)
    if (!result.ok && result.errors?.length) {
      setFormErrors(result.errors)
    }
  }

  const isPristine = mode === "edit" && Boolean(initial) && !isDirty
  const resolvedSubmitLabel =
    submitLabel ?? (mode === "create" ? "Crear producto" : "Guardar cambios")
  const resolvedPendingLabel =
    pendingLabel ?? (mode === "create" ? "Creando…" : "Guardando…")

  return (
    <form onSubmit={handleSubmit} noValidate className={cn("space-y-5", className)}>
      {formErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formErrors.length === 1 ? (
            <p>{formErrors[0]}</p>
          ) : (
            <ul className="list-inside list-disc space-y-0.5">
              {formErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="producto-nombre">Nombre</Label>
        {serverError("nombre") && (
          <p id="producto-nombre-server-error" role="alert" className="text-xs text-destructive">
            {serverError("nombre")}
          </p>
        )}
        <Input
          id="producto-nombre"
          ref={(el) => {
            fieldRefs.current.nombre = el
          }}
          value={values.nombre}
          placeholder="ej: Pan de campo"
          autoFocus={mode === "create"}
          disabled={disabled}
          aria-invalid={serverError("nombre") || clientError("nombre") ? true : undefined}
          aria-describedby={
            serverError("nombre")
              ? "producto-nombre-server-error"
              : clientError("nombre")
                ? "producto-nombre-error"
                : undefined
          }
          onChange={(e) => setField("nombre", e.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, nombre: true }))}
        />
        {clientError("nombre") && (
          <p id="producto-nombre-error" className="text-xs text-destructive">
            {clientError("nombre")}
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
                step={campo.key === "costoFabricacionUnitarioArs" ? "0.01" : "any"}
                min={campo.min}
                placeholder={campo.placeholder}
                helper={campo.helper}
                value={values[campo.key]}
                serverError={serverError(campo.key)}
                error={clientError(campo.key)}
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

      <fieldset
        disabled={disabled}
        className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 disabled:opacity-70"
      >
        <legend className="flex w-full items-center gap-2 px-1 text-sm font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-secondary/70 text-muted-foreground">
            <Target className="size-3.5" aria-hidden="true" />
          </span>
          Setpoints (opcional)
        </legend>
        <p className="text-xs text-muted-foreground">
          Valor objetivo dentro del rango. Sólo se usa si se reactiva el despacho automático. Dejá en
          blanco para no usarlo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SETPOINTS.map((campo) => (
            <NumberField
              key={campo.key}
              id={`producto-${campo.key}`}
              label={campo.label}
              unidad={campo.unidad}
              min={campo.min}
              placeholder={campo.placeholder}
              helper={campo.helper}
              value={values[campo.key]}
              serverError={serverError(campo.key)}
              error={clientError(campo.key)}
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
  step = "any",
  min,
  placeholder,
  helper,
  value,
  serverError,
  error,
  disabled,
  inputRef,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  unidad: string
  step?: string
  min?: number
  placeholder: string
  helper?: string
  value: string
  serverError?: string
  error?: string
  disabled?: boolean
  inputRef?: (el: HTMLInputElement | null) => void
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  const describedBy = serverError
    ? `${id}-server-error`
    : error
      ? `${id}-error`
      : helper
        ? `${id}-helper`
        : undefined

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{unidad}</span>
      </div>
      {serverError && (
        <p id={`${id}-server-error`} role="alert" className="mb-1 text-xs text-destructive">
          {serverError}
        </p>
      )}
      <Input
        id={id}
        ref={inputRef}
        type="number"
        step={step}
        min={min}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={serverError || error ? true : undefined}
        aria-describedby={describedBy}
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
