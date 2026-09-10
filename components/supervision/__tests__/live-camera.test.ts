import { describe, expect, it, vi } from "vitest"
import { CAMERA_EVIDENCE_TTL_MS, canRequestCameraFrame, getCameraHealth, getReconnectDelay, isCameraEvidenceFresh, isCurrentCameraGeneration, shouldPublishCameraEvidence, startCameraSessionDelete } from "@/lib/camera-health"

describe("reconexión de cámara", () => {
  it("usa backoff progresivo y mantiene el máximo en 10 segundos", () => {
    expect([0, 1, 2, 3, 4].map(getReconnectDelay)).toEqual([1000, 2000, 5000, 10000, 10000])
  })
})

describe("evidencia de salud de cámara", () => {
  const base = { mounted: true, configured: true, peerConnected: true, trackLive: true, trackEnded: false, lastEvidenceAt: 1_000 }

  it("no considera SDP o una conexión sin frames como disponible", () => {
    expect(getCameraHealth({ ...base, lastEvidenceAt: null, now: 1_001 }).availability).toBe("unknown")
    expect(getCameraHealth({ ...base, peerConnected: false, now: 1_001 }).availability).toBe("unknown")
  })

  it("requiere peer conectado y frames recientes", () => {
    expect(getCameraHealth({ ...base, now: 1_001 })).toMatchObject({ availability: "available", checkedAt: new Date(1_000).toISOString() })
  })

  it("degrada la evidencia al vencer el TTL de diez segundos", () => {
    expect(isCameraEvidenceFresh(1_000, 1_000 + CAMERA_EVIDENCE_TTL_MS)).toBe(true)
    expect(getCameraHealth({ ...base, now: 1_000 + CAMERA_EVIDENCE_TTL_MS + 1 }).availability).toBe("degraded")
  })

  it("reporta conexión fallida, ocultamiento y desmontaje sin afirmar una caída oculta", () => {
    expect(getCameraHealth({ ...base, connectionFailed: true, now: 1_001 }).availability).toBe("disconnected")
    expect(getCameraHealth({ ...base, connectionFailed: true, now: 2_000 }).checkedAt).toBe(new Date(2_000).toISOString())
    expect(getCameraHealth({ ...base, configured: false, now: 1_001 }).detail).toBe("Configuración de cámara pendiente")
    expect(getCameraHealth({ ...base, mounted: true, configured: true, now: 1_001, lastEvidenceAt: null }).availability).toBe("unknown")
    expect(getCameraHealth({ ...base, mounted: false, now: 1_001 }).availability).toBe("unknown")
  })

  it("rechaza callbacks de una generación vieja", () => {
    expect(isCurrentCameraGeneration(3, 4)).toBe(false)
    expect(isCurrentCameraGeneration(4, 4)).toBe(true)
  })

  it("publica evidencia como máximo una vez por segundo, pero permite la primera y las transiciones", () => {
    expect(shouldPublishCameraEvidence(null, 1_000)).toBe(true)
    expect(shouldPublishCameraEvidence(1_000, 1_500)).toBe(false)
    expect(shouldPublishCameraEvidence(1_000, 2_000)).toBe(true)
  })

  it("mantiene como máximo un callback de frame pendiente", () => {
    expect(canRequestCameraFrame(null)).toBe(true)
    expect(canRequestCameraFrame(42)).toBe(false)
  })

  it("inicia el DELETE de sesión sin bloquear la limpieza local", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({} as Response))
    vi.stubGlobal("fetch", fetchMock)
    expect(startCameraSessionDelete("https://camera.test/session")).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith("https://camera.test/session", expect.objectContaining({ method: "DELETE" }))
    await Promise.resolve()
    await Promise.resolve()
    vi.unstubAllGlobals()
  })
})
