"use client"

import { useId, useRef, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Check, Croissant, Pause, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Producto } from "@/lib/production-data"

const fmtNum = (value: number) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: 1 })

interface ProductGridProps {
  productos?: Producto[]
  selectedId: string | null
  error?: string | null
  /** Supervisor/Administrador ven los icon-buttons de editar y desactivar. */
  canManage?: boolean
  onCreate?: () => void
  onEdit?: (producto: Producto) => void
  onDelete?: (producto: Producto) => void
  /** La grilla quedó vacía sólo porque el filtro ocultó a todos los retirados. */
  allRetired?: boolean
  onShowRetired?: () => void
}

// Selectable product grid (radio-group semantics with roving tabIndex).
// Selection is deep-linked via ?productoId= so it survives refresh.
export default function ProductGrid({
  productos = [],
  selectedId,
  error,
  canManage = false,
  onCreate,
  onEdit,
  onDelete,
  allRetired = false,
  onShowRetired,
}: ProductGridProps) {
  const baseId = useId()
  const router = useRouter()
  const buttonsRef = useRef<Record<string, HTMLDivElement | null>>({})

  const select = (productoId: string) => {
    router.push(`/configuracion?productoId=${encodeURIComponent(productoId)}`)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const focusedId = selectedId ?? productos[0]?.id
    if (!focusedId) return

    let nextIndex: number | null = null
    const currentIndex = productos.findIndex((p) => p.id === focusedId)

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % productos.length
        break
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + productos.length) % productos.length
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = productos.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    const nextId = productos[nextIndex].id
    select(nextId)
    buttonsRef.current[nextId]?.focus()
  }

  if (productos.length === 0) {
    return (
      <EmptyState
        error={error}
        allRetired={allRetired}
        canManage={canManage}
        onCreate={onCreate}
        onShowRetired={onShowRetired}
      />
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Productos"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {productos.map((producto, index) => {
        const selected = producto.id === selectedId
        // Roving tabIndex: when nothing is selected, the first item stays
        // tabbable so Tab can enter the radiogroup.
        const isTabbable = selected || (selectedId === null && index === 0)
        const labelId = `${baseId}-${producto.id}-label`
        return (
          <div
            key={producto.id}
            ref={(el) => {
              buttonsRef.current[producto.id] = el
            }}
            role="radio"
            aria-checked={selected}
            aria-labelledby={labelId}
            tabIndex={isTabbable ? 0 : -1}
            onClick={() => select(producto.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                select(producto.id)
              }
            }}
            className={cn(
              "group relative flex cursor-pointer flex-col items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200",
              "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected && "border-primary bg-primary/5 shadow-md ring-2 ring-primary/30",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground transition-colors duration-200",
                selected && "bg-primary/15 text-primary",
              )}
            >
              <Croissant className="size-5" />
            </span>
            <span id={labelId} className="text-sm font-semibold text-foreground">
              {producto.nombre}
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              Horno {fmtNum(producto.tempMin)}–{fmtNum(producto.tempMax)} °C
              <br />
              Cinta {fmtNum(producto.velocidadCintaMin)}–{fmtNum(producto.velocidadCintaMax)} m/s
            </span>
            {!producto.activo ? (
              <Badge variant="outline" className="mt-1 text-muted-foreground">
                <Pause className="size-3" aria-hidden="true" />
                Inactivo
              </Badge>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                Activo
              </span>
            )}
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-all duration-200",
                selected && "opacity-100",
              )}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>

            {canManage && (
              <div
                className="mt-1 flex w-full items-center justify-end gap-1 border-t border-border pt-2.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground opacity-100 transition-opacity duration-200 hover:bg-secondary hover:text-foreground sm:opacity-70 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  aria-label={`Editar ${producto.nombre}`}
                  title="Editar producto"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.(producto)
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground opacity-100 transition-opacity duration-200 hover:bg-destructive/15 hover:text-destructive sm:opacity-70 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  aria-label={`Desactivar ${producto.nombre}`}
                  title="Desactivar producto"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.(producto)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({
  error,
  allRetired,
  canManage,
  onCreate,
  onShowRetired,
}: {
  error?: string | null
  allRetired: boolean
  canManage: boolean
  onCreate?: () => void
  onShowRetired?: () => void
}) {
  if (allRetired) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
          <Pause className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">Todos los productos están retirados</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          El filtro “Ocultar retirados” dejó la lista vacía.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onShowRetired} className="mt-2">
          Mostrar retirados
        </Button>
      </div>
    )
  }

  return (
    <div
      role={error ? "alert" : undefined}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
        <Croissant className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">
        {error ? "No se pudieron cargar los productos" : "No hay productos configurados"}
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {error ??
          "Cuando se registren productos, vas a poder seleccionarlos para editar sus parámetros."}
      </p>
      {!error && canManage && (
        <Button type="button" size="sm" onClick={onCreate} className="mt-2 gap-1.5">
          Nuevo producto
        </Button>
      )}
    </div>
  )
}
