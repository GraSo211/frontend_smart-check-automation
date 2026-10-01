import type { Metadata } from "next"
import { Factory } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Línea de Producción | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={Factory}
      title="Línea de Producción"
      description="Monitoreo del horno y la cinta transportadora de la línea de producción."
    />
  )
}
