import type { SourceSync } from '@/lib/monitoring-types'
import { confirmDataEvent, confirmQuery } from '@/lib/monitoring-store'

/** Pure sync transitions shared by the monitoring provider and data hooks. */
export function recordSourceQuery(sync: SourceSync, at: string): SourceSync {
  return confirmQuery(sync, at)
}

export function recordSourceDataEvent(sync: SourceSync, at: string): SourceSync {
  return confirmDataEvent(sync, at)
}
