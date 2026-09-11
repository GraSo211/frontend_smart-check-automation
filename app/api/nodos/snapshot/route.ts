import { proxyMonitoringJson } from "@/lib/monitoring-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return proxyMonitoringJson(request, "/api/v1/dispositivos", true)
}
