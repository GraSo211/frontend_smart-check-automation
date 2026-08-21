"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutPanelLeft, LogOut } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from "@/components/ui/sidebar"
import { SIDEBAR_NAV, type SidebarNavItem } from "@/lib/sidebar-nav"
import { ROLE_COLORS } from "@/lib/role-badge"
import { logoutAction } from "@/actions/auth"
import type { UserRole } from "@/lib/auth"

interface AppSidebarProps {
  /** Perfil del usuario autenticado (undefined en rutas públicas) */
  user?: {
    nombre: string
    rol: UserRole
  }
}

export default function AppSidebar({ user }: AppSidebarProps) {
  const selectedTab = usePathname()
  const sidebar = useSidebar()

  return (
    <Sidebar collapsible="icon" className="z-100">
      <SidebarHeader onClick={() => sidebar.toggleSidebar()} >
        <div className="flex items-center gap-2  py-1 ">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20 " >
            <LayoutPanelLeft className="size-4 text-sidebar-primary " aria-hidden="true" />
          </div>
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            Panel de Control
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {SIDEBAR_NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    isActive={selectedTab === item.href}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {user && <UserFooter user={user} />}
      <SidebarRail />
    </Sidebar>
  )
}

function NavItem({
  item,
  isActive,
}: {
  item: SidebarNavItem
  isActive: boolean
}) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={isActive}
        tooltip={item.label}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function UserFooter({
  user,
}: {
  user: { nombre: string; rol: UserRole }
}) {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip={user.nombre}
            className="cursor-default data-[active=true]:bg-transparent"
          >
            {/* Avatar con inicial */}
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary ring-1 ring-primary/30"
              aria-hidden="true"
            >
              {user.nombre.charAt(0).toUpperCase()}
            </div>

            {/* Nombre y rol (ocultos en modo colapsado) */}
            {!collapsed && (
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                  {user.nombre}
                </span>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${ROLE_COLORS[user.rol]}`}
                >
                  {user.rol}
                </span>
              </div>
            )}

            {/* Botón de logout */}
            {!collapsed && (
              <form action={logoutAction} onClick={(e) => e.stopPropagation()}>
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
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
