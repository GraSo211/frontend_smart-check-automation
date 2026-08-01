import type { Metadata } from "next"
import { SlidersHorizontal } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Parámetros de Configuración | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={SlidersHorizontal}
      title="Parámetros de Configuración"
      description="Ajuste de parámetros del sistema de control de calidad industrial."
    />
  )
}
