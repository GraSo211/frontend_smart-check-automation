import { getImpactoEconomico } from "@/actions/api"
import { ApiError } from "@/lib/api-client"

export async function GET() {
  try {
    return Response.json(await getImpactoEconomico(), { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "No se pudo consultar el impacto económico." }, {
      status: error instanceof ApiError ? error.status : 502,
      headers: { "cache-control": "private, no-store" },
    })
  }
}
