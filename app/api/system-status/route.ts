import { proxyMonitoringJson } from '@/lib/monitoring-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return proxyMonitoringJson(request, '/health', true, false)
}
