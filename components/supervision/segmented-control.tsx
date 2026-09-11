"use client"

import { useRef, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export type SegmentedOption = {
  id: string
  label: string
}

type SegmentedControlProps = {
  label: string
  options: SegmentedOption[]
  value: string
  onChange: (id: string) => void
  className?: string
}

/**
 * Control segmentado accesible sobre `role="radiogroup"`. La selección sigue
 * al foco con las flechas, una sola opción queda en el orden de tabulación y
 * el foco visible usa el anillo del sistema de diseño.
 */
export default function SegmentedControl({ label, options, value, onChange, className }: SegmentedControlProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([])

  if (options.length === 0) return null

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length
    onChange(options[next].id)
    buttonsRef.current[next]?.focus()
  }

  const focusAndSelect = (index: number) => {
    onChange(options[index].id)
    buttonsRef.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault()
        move(index, 1)
        break
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault()
        move(index, -1)
        break
      case "Home":
        event.preventDefault()
        focusAndSelect(0)
        break
      case "End":
        event.preventDefault()
        focusAndSelect(options.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-border bg-muted/50 p-1",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            ref={(element) => {
              buttonsRef.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap outline-none transition-colors duration-200",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
