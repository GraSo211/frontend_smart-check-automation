import {
  Database,
  Eye,
  Factory,
  FileBarChart,
  LayoutDashboard,
  MapPin,
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
      { href: "/linea-produccion", label: "Línea de Producción", icon: Factory },
      { href: "/lotes", label: "Lotes y Datos Históricos", icon: Database },
      { href: "/reportes", label: "Reportes", icon: FileBarChart },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracion", label: "Parámetros de Configuración", icon: SlidersHorizontal },
      { href: "/sectores", label: "Sectores", icon: MapPin },
      { href: "/alertas", label: "Manejo de Alertas", icon: TriangleAlert },
      { href: "/nodos", label: "Estado de los Nodos", icon: Cpu },
      { href: "/usuarios", label: "Usuarios y Roles", icon: Users },
    ],
  },
]
