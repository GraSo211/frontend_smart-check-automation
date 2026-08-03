"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutPanelLeft } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
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

export default function AppSidebar() {
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
