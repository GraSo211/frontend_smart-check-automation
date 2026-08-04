"use client"

import { useId, useRef, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Croissant } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { ParametroProducto } from "@/lib/parametros-producto"

const fmtNum = (value: number) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: 1 })

interface ProductGridProps {
  productos?: ParametroProducto[]
  selectedId: string | null
}

// Selectable product grid (radio-group semantics with roving tabIndex).
// Selection is deep-linked via ?productoId= so it survives refresh.
export default function ProductGrid({ productos = [], selectedId }: ProductGridProps) {
  const baseId = useId()
  const router = useRouter()
  const buttonsRef = useRef<Record<string, HTMLButtonElement | null>>({})

  const select = (productoId: string) => {
    router.push(`/configuracion?productoId=${productoId}`)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const focusedId = selectedId ?? productos[0]?.productoId
    if (!focusedId) return

    let nextIndex: number | null = null
    const currentIndex = productos.findIndex((p) => p.productoId === focusedId)

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
    const nextId = productos[nextIndex].productoId
    select(nextId)
    buttonsRef.current[nextId]?.focus()
  }

  if (productos.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No hay productos configurados.
      </p>
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
      {productos.map((producto) => {
        const selected = producto.productoId === selectedId
        return (
          <button
            key={producto.productoId}
            ref={(el) => {
              buttonsRef.current[producto.productoId] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-labelledby={`${baseId}-${producto.productoId}-label`}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(producto.productoId)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors",
              "hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected && "border-primary bg-primary/5 ring-2 ring-primary/40",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground",
                selected && "bg-primary/15 text-primary",
              )}
            >
              <Croissant className="size-5" />
            </span>
            <span id={`${baseId}-${producto.productoId}-label`} className="text-sm font-semibold text-foreground">
              {producto.productoNombre}
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              Horno {fmtNum(producto.tempMin)}–{fmtNum(producto.tempMax)} °C
              <br />
              Cinta {fmtNum(producto.velocidadCintaMin)}–{fmtNum(producto.velocidadCintaMax)} m/s
            </span>
            {!producto.activo && (
              <Badge variant="destructive" className="mt-1">
                Inactivo
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
