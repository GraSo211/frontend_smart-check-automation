let lastSyncISO: string | null = null
const listeners = new Set<() => void>()

export function setLastSync(iso: string) {
  lastSyncISO = iso
  listeners.forEach((l) => l())
}

export function getLastSync(): string | null {
  return lastSyncISO
}

export function subscribeToLastSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
