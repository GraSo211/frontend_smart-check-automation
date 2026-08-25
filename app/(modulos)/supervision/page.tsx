import type { Metadata } from "next"
import { Eye } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Supervisión en Vivo | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={Eye}
      title="Supervisión en Vivo"
      description="Observación de líneas de producción y telemetría de hornos en tiempo real."
    />
  )
}
