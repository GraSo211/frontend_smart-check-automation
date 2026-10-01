import type { Metadata } from "next"
import { FileBarChart } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Reportes | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={FileBarChart}
      title="Reportes"
      description="Generación y exportación de reportes de calidad, producción y trazabilidad."
    />
  )
}
