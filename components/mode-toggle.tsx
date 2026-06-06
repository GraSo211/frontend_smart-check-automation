"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const THEME_OPTIONS = [
  { value: "light" as const, label: "Claro", icon: Sun },
  { value: "dark" as const, label: "Oscuro", icon: Moon },
  { value: "system" as const, label: "Sistema", icon: Monitor },
]

export function ModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const active = mounted ? (theme ?? "system") : "system"
  const ActiveIcon =
    active === "dark" || (active === "system" && resolvedTheme === "dark")
      ? Moon
      : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            size="icon"
            aria-label="Cambiar tema"
          >
            <ActiveIcon aria-hidden="true" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-36">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = mounted && value === theme
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              data-active={isActive || undefined}
            >
              <Icon aria-hidden="true" />
              {label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="ml-auto text-xs text-primary"
                >
                  ●
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
