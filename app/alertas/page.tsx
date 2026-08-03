import type { Metadata } from "next"
import { TriangleAlert } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Manejo de Alertas | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={TriangleAlert}
      title="Manejo de Alertas"
      description="Gestión de alertas y notificaciones de calidad en tiempo real."
    />
  )
}
