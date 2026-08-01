import type { Metadata } from "next"
import { Cpu } from "lucide-react"
import { PlaceholderSection } from "@/components/layout/placeholder-section"

export const metadata: Metadata = {
  title: "Estado de los Nodos | Smart-Check Automation",
}

export default function Page() {
  return (
    <PlaceholderSection
      icon={Cpu}
      title="Estado de los Nodos"
      description="Monitoreo del estado y salud de los nodos IoT Edge del sistema."
    />
  )
}
