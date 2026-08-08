import Image from "next/image"
import { Activity, LogOut } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTriggerButton } from "@/components/layout/sidebar-trigger"
import { logoutAction } from "@/actions/auth"
import type { UserRole } from "@/lib/auth"

// ─── Rol badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<UserRole, string> = {
  Administrador:
    "bg-violet-950/40 text-violet-300 ring-violet-700",
  Supervisor:
    "bg-blue-950/40 text-blue-300 ring-blue-700",
  Operario:
    "bg-emerald-950/40 text-emerald-300 ring-emerald-700",
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeaderProps {
  /** Perfil del usuario autenticado (undefined en rutas públicas) */
  user?: {
    nombre: string
    rol: UserRole
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

// Top application header with branding, enterprise badge, live system status, and user session info.
export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <SidebarTriggerButton />
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/20 p-1 shadow-sm">
            <Image
              src="/sca/logo_image_only.svg"
              alt="Smart-Check Automation"
              width={40}
              height={40}
              className="h-full w-full "
            />
          </div>
          <Image
            src="/sca/logo_title.svg"
            alt="Smart-Check Automation"
            width={120}
            height={42}
            className="h-10 w-auto"
          />

          {user && (
            <nav className="ml-4 hidden items-center gap-1 sm:flex">
              <a
                href="/"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent/20"
              >
                Supervisión
              </a>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Estado del sistema */}
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-700">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Todos los Sistemas Funcionando
          </span>
          <span className="hidden items-center gap-1.5 rounded-full bg-sidebar-accent/15 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 ring-1 ring-inset ring-sidebar-border sm:inline-flex">
            <Activity className="size-3.5 text-sidebar-primary" aria-hidden="true" />
            IoT Edge En Vivo
          </span>

          <ModeToggle />

          {/* Perfil del usuario autenticado */}
          {user && (
            <div className="flex items-center gap-2 border-l border-sidebar-border pl-2.5">
              {/* Avatar con inicial */}
              <div
                className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary ring-1 ring-primary/30"
                aria-hidden="true"
              >
                {user.nombre.charAt(0).toUpperCase()}
              </div>

              {/* Nombre y rol (solo en pantallas medianas+) */}
              <div className="hidden flex-col md:flex">
                <span className="text-xs font-semibold leading-tight text-sidebar-foreground">
                  {user.nombre}
                </span>
                <span
                  className={`mt-0.5 inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${ROLE_COLORS[user.rol]}`}
                >
                  {user.rol}
                </span>
              </div>

              {/* Botón de logout */}
              <form action={logoutAction}>
                <button
                  id="btn-logout"
                  type="submit"
                  title="Cerrar sesión"
                  className="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/20 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

