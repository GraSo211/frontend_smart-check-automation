"use client"

import { Fragment, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const THEME_GROUPS = [
  {
    label: "Fermar",
    items: [
      { value: "fermar-light", label: "Claro", icon: Sun },
      { value: "fermar-dark", label: "Oscuro", icon: Moon },
    ],
  },
  {
    label: "SCA",
    items: [
      { value: "sca-light", label: "Claro", icon: Sun },
      { value: "sca-dark", label: "Oscuro", icon: Moon },
    ],
  },
]

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" aria-label="Cambiar tema" disabled>
        <Sun aria-hidden="true" />
      </Button>
    )
  }

  const isDark = theme?.endsWith("-dark") ?? false
  const ActiveIcon = isDark ? Moon : Sun

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
      <DropdownMenuContent align="end" className="min-w-40">
        {THEME_GROUPS.map((group, index) => (
          <Fragment key={group.label}>
            {index > 0 && <DropdownMenuSeparator className="my-1" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              {group.items.map(({ value, label, icon: Icon }) => {
                const isActive = value === theme
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
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
