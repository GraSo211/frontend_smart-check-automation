import {
  Database,
  Eye,
  LayoutDashboard,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  Cpu,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type SidebarNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export type SidebarNavGroup = {
  label: string
  items: SidebarNavItem[]
}

export const SIDEBAR_NAV: SidebarNavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/supervision", label: "Supervisión en Vivo", icon: Eye },
      { href: "/lotes", label: "Lotes y Datos Históricos", icon: Database },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracion", label: "Parámetros de Configuración", icon: SlidersHorizontal },
      { href: "/alertas", label: "Manejo de Alertas", icon: TriangleAlert },
      { href: "/nodos", label: "Estado de los Nodos", icon: Cpu },
      { href: "/usuarios", label: "Usuarios y Roles", icon: Users },
    ],
  },
]
