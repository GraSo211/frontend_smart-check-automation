import { proxyMonitoringEvents } from "@/lib/monitoring-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return proxyMonitoringEvents(request, "/api/v1/lotes-productivos/events")
}
