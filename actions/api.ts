import type { ProductionRun, ProductionResponse } from "@/lib/production-data"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function getAllProductionRuns(): Promise<ProductionRun[]> {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL no está definida. Crea un archivo .env.local con NEXT_PUBLIC_API_URL=https://tu-host",
    )
  }

  const response = await fetch(`${API_URL}/api/v1/lotes-productivos?page=1&pageSize=100`, {
    next: { revalidate: 60 },
  })

  if (!response.ok) {
    throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
  }

  const result: ProductionResponse = await response.json()

  if (!result.success) {
    throw new Error(result.message ?? "Error desconocido del servidor")
  }
  
  return result.data.items
}
