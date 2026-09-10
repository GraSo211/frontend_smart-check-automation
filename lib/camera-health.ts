export const CAMERA_EVIDENCE_TTL_MS = 10_000
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000]

export type CameraAvailability = "available" | "degraded" | "disconnected" | "unknown"

export function getReconnectDelay(attempt: number) {
  return RECONNECT_DELAYS[Math.min(Math.max(attempt, 0), RECONNECT_DELAYS.length - 1)]
}

export type CameraHealthSnapshot = {
  mounted: boolean
  configured: boolean
  peerConnected: boolean
  /** A live video track accepted by the current peer/session. */
  trackLive?: boolean
  trackEnded: boolean
  connectionFailed?: boolean
  lastEvidenceAt: number | null
  now?: number
}

export type CameraHealthReport = {
  availability: CameraAvailability
  checkedAt: string | null
  detail: string
}

export function isCameraEvidenceFresh(lastEvidenceAt: number | null, now = Date.now()) {
  return lastEvidenceAt !== null && now - lastEvidenceAt <= CAMERA_EVIDENCE_TTL_MS
}

export function cameraEvidenceTimestamp(receivedAt = Date.now()) {
  return new Date(receivedAt).toISOString()
}

/**
 * Converts transport/playback facts into the monitoring contract. SDP, an
 * attached MediaStream, and `playing` are deliberately not evidence here.
 */
export function getCameraHealth({
  mounted,
  configured,
  peerConnected,
  trackLive = false,
  trackEnded,
  connectionFailed = false,
  lastEvidenceAt,
  now = Date.now(),
}: CameraHealthSnapshot): CameraHealthReport {
  const checkedAt = lastEvidenceAt === null ? null : cameraEvidenceTimestamp(lastEvidenceAt)

  if (!mounted) {
    return { availability: "unknown", checkedAt: null, detail: "Sin reproducción activa" }
  }

  if (!configured) {
    return { availability: "unknown", checkedAt: null, detail: "Configuración de cámara pendiente" }
  }

  if (connectionFailed || trackEnded) {
    return { availability: "disconnected", checkedAt: new Date(now).toISOString(), detail: "Conexión de cámara interrumpida" }
  }

  if (!peerConnected) {
    return { availability: "unknown", checkedAt: null, detail: "Conectando; aún sin video" }
  }

  if (!trackLive) {
    return { availability: "unknown", checkedAt: null, detail: "Conectando; aún sin video" }
  }

  if (peerConnected && isCameraEvidenceFresh(lastEvidenceAt, now)) {
    return { availability: "available", checkedAt, detail: "Video recibido" }
  }

  if (lastEvidenceAt !== null && !isCameraEvidenceFresh(lastEvidenceAt, now)) {
    return { availability: "degraded", checkedAt, detail: "Sin progreso de video" }
  }

  return { availability: "unknown", checkedAt: null, detail: "Conectando; aún sin video" }
}

export function isCurrentCameraGeneration(generation: number, currentGeneration: number) {
  return generation === currentGeneration
}

export function shouldPublishCameraEvidence(lastPublishedAt: number | null, evidenceAt: number, intervalMs = 1_000) {
  return lastPublishedAt === null || evidenceAt - lastPublishedAt >= intervalMs
}

export function canRequestCameraFrame(pendingCallback: number | null) {
  return pendingCallback === null
}

export function startCameraSessionDelete(location: string) {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000)
  void fetch(location, { method: 'DELETE', keepalive: true, signal: controller.signal })
    .catch(() => undefined)
    .finally(() => globalThis.clearTimeout(timeout))
}
