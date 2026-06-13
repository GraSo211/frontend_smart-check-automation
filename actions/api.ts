import type { ProductionRun, ProductionResponse } from "@/lib/production-data"

const API_URL = process.env.API_URL

export async function getAllProductionRuns(): Promise<ProductionRun[]> {
  if (!API_URL) {
    throw new Error(
      "API_URL no está definida. Crea un archivo .env.local con API_URL=http://tu-host/api",
    )
  }

  const response = await fetch(`${API_URL}/api/v1/lotes-productivos?page=1&pageSize=10`, {
    next: { revalidate: 60 },
  })
  console.log("Respuesta de la API:", response)
  if (!response.ok) {
    throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
  }

  const result: ProductionResponse = await response.json()
  return result.data
}
