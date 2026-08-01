import type { Metadata } from "next"
import { Users } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Usuarios y Roles | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={Users}
      title="Usuarios y Roles"
      description="Administración de usuarios del sistema y asignación de roles."
    />
  )
}
