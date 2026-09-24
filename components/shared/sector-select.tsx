import { cn } from "@/lib/utils"
import type { Sector } from "@/lib/production-data"

export interface SectorSelectProps {
  /** Identificador del control. Debe coincidir con el `htmlFor` del label. */
  id: string
  /** Sector elegido (`""` representa "sin sector"). */
  value: string
  onChange: (value: string) => void
  sectores: Sector[]
  /** Etiqueta visible. Si se omite, usá `ariaLabel` para no perder accesibilidad. */
  label?: string
  /** Nombre accesible cuando no hay label visible. */
  ariaLabel?: string
  /**
   * Agrega una opción vacía para dejar el campo sin sector. Por defecto está
   * desactivada: los filtros siempre exigen un sector.
   */
  allowEmpty?: boolean
  /** Texto de la opción vacía. Sólo se usa si `allowEmpty` es verdadero. */
  emptyOptionLabel?: string
  disabled?: boolean
  required?: boolean
  /** Mensaje de error. Si existe, marca el control como inválido. */
  error?: string | null
  /** Texto de ayuda, sólo visible cuando no hay error. */
  hint?: string
  /** Clases extra para el `<select>` (ancho, etc.). */
  className?: string
  /** Clases extra para el contenedor. */
  containerClassName?: string
}

/**
 * Select nativo de sectores, reutilizable y accesible. Mantiene el mismo estilo
 * que los selects existentes (filtros de lotes, historial de configuración) para
 * que no haya divergencias visuales entre pantallas.
 */
export function SectorSelect({
  id,
  value,
  onChange,
  sectores,
  label,
  ariaLabel,
  allowEmpty = false,
  emptyOptionLabel = "Sin sector",
  disabled = false,
  required = false,
  error = null,
  hint,
  className,
  containerClassName,
}: SectorSelectProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined
  const sinSectores = sectores.length === 0

  return (
    <div className={cn("w-full", containerClassName)}>
      {label ? (
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60",
          error && "border-destructive focus:border-destructive focus:ring-destructive/20",
          className,
        )}
      >
        {allowEmpty ? <option value="">{emptyOptionLabel}</option> : null}
        {!allowEmpty && sinSectores ? (
          <option value="">Sin sectores disponibles</option>
        ) : null}
        {sectores.map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.nombre}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
