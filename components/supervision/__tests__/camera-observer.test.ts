import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { createCameraObserver } from "@/lib/camera-observer"
import { CAMERA_EVIDENCE_TTL_MS } from "@/lib/camera-health"

type FrameCallback = (now: number, metadata: unknown) => void
type TestStatsReport = { type?: string; kind?: string; mediaType?: string; framesDecoded?: number }

function makeVideo() {
  let nextHandle = 0
  const callbacks = new Map<number, FrameCallback>()
  const video = {
    requestVideoFrameCallback: vi.fn((callback: FrameCallback) => {
      const handle = ++nextHandle
      callbacks.set(handle, callback)
      return handle
    }),
    cancelVideoFrameCallback: vi.fn(),
  }
  return {
    video,
    invoke(handle: number) {
      callbacks.get(handle)?.(0, {})
    },
    pending() {
      return Math.max(...callbacks.keys())
    },
  }
}

function liveTrack() {
  return { kind: "video", readyState: "live" } as MediaStreamTrack
}

function stats(framesDecoded: number) {
  return { forEach: (callback: (report: TestStatsReport) => void) => callback({ type: "inbound-rtp", kind: "video", framesDecoded }) }
}

describe("CameraObserverController", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => vi.useRealTimers())

  it("rearmerma un único callback al recuperar connected sin forzar otra conexión", () => {
    const media = makeVideo()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence: vi.fn(), onStalled })
    observer.start(1, media.video, {})
    observer.setTrack(liveTrack())
    observer.setConnected()

    observer.setDisconnected()
    observer.setConnected()
    const callbackAfterRecovery = media.pending()

    expect(media.video.requestVideoFrameCallback).toHaveBeenCalledTimes(3)
    expect(media.video.cancelVideoFrameCallback).toHaveBeenCalledTimes(2)
    media.invoke(callbackAfterRecovery)
    expect(media.video.requestVideoFrameCallback).toHaveBeenCalledTimes(4)
    expect(onStalled).not.toHaveBeenCalled()
  })

  it("reinicia la ventana visible y descarta stats que cruzan hidden/visible", async () => {
    const first = Promise.withResolvers<ReturnType<typeof stats>>()
    const second = Promise.withResolvers<ReturnType<typeof stats>>()
    const getStats = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, { cancelVideoFrameCallback: undefined }, { getStats })
    observer.setTrack(liveTrack())
    observer.setConnected()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(getStats).toHaveBeenCalledTimes(1)
    observer.setVisibility(true)
    first.resolve(stats(100))
    await Promise.resolve()
    observer.setVisibility(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(getStats).toHaveBeenCalledTimes(2)
    second.resolve(stats(101)) // first sample of the new visible epoch
    await Promise.resolve()
    expect(onEvidence).not.toHaveBeenCalled()
    expect(onStalled).not.toHaveBeenCalled()
  })

  it("publica el frame 999 al vencer el throttle de pared, sin ciclo de timer", async () => {
    const media = makeVideo()
    const onEvidence = vi.fn()
    const observer = createCameraObserver({ onEvidence })
    observer.start(1, media.video, {})
    observer.setTrack(liveTrack())
    observer.setConnected()

    media.invoke(media.pending())
    expect(onEvidence).toHaveBeenLastCalledWith(0)
    await vi.advanceTimersByTimeAsync(999)
    media.invoke(media.pending())
    await vi.advanceTimersByTimeAsync(1)
    expect(onEvidence.mock.calls.map(([timestamp]) => timestamp)).toEqual([0, 999])
    await vi.advanceTimersByTimeAsync(5_000)
    expect(onEvidence.mock.calls.map(([timestamp]) => timestamp)).toEqual([0, 999])
  })

  it("no permite que un callback viejo borre el handle nuevo", () => {
    const media = makeVideo()
    const observer = createCameraObserver({ onEvidence: vi.fn() })
    observer.start(1, media.video, {})
    const oldHandle = media.pending()
    observer.setConnected()
    const currentHandle = media.pending()
    observer.setTrack(liveTrack())
    media.invoke(oldHandle)
    expect(media.pending()).toBe(currentHandle)
    media.invoke(currentHandle)
    expect(media.pending()).not.toBe(currentHandle)
  })

  it("conserva el callback vigente cuando dos videos reutilizan el mismo handle", () => {
    const first = makeVideo()
    const second = makeVideo()
    const onEvidence = vi.fn()
    const observer = createCameraObserver({ onEvidence })
    observer.start(1, first.video, {})
    observer.setConnected()
    const oldHandle = first.pending()
    observer.start(2, second.video, {})
    observer.setTrack(liveTrack())
    observer.setConnected()
    const currentHandle = second.pending()
    expect(currentHandle).toBe(oldHandle)
    first.invoke(oldHandle)
    second.invoke(currentHandle)
    expect(onEvidence).toHaveBeenCalledWith(0)
    expect(second.pending()).toBeGreaterThan(currentHandle)
    observer.dispose()
  })

  it("no afirma vida sin un track de video aceptado", () => {
    const onEvidence = vi.fn()
    const media = makeVideo()
    const observer = createCameraObserver({ onEvidence })
    observer.start(1, media.video, {})
    observer.setConnected()
    media.invoke(media.pending())
    expect(onEvidence).not.toHaveBeenCalled()
  })

  it("marca stall si el peer queda conectado sin track durante el TTL", async () => {
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, makeVideo().video, {})
    observer.setConnected()

    await vi.advanceTimersByTimeAsync(CAMERA_EVIDENCE_TTL_MS + 2_000)

    expect(onEvidence).not.toHaveBeenCalled()
    expect(onStalled).toHaveBeenCalled()
  })

  it("marca stall si un track live no entrega callbacks de frame", async () => {
    const media = makeVideo()
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, media.video, {})
    observer.setTrack(liveTrack())
    observer.setConnected()

    await vi.advanceTimersByTimeAsync(CAMERA_EVIDENCE_TTL_MS + 2_000)

    expect(onEvidence).not.toHaveBeenCalled()
    expect(onStalled).toHaveBeenCalled()
  })

  it.each([
    ["queda pendiente", () => new Promise<ReturnType<typeof stats>>(() => {})],
    ["es rechazada", () => Promise.reject(new Error("stats unavailable"))],
  ])("marca stall si getStats %s indefinidamente", async (_description, getStats) => {
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, { cancelVideoFrameCallback: undefined }, { getStats })
    observer.setTrack(liveTrack())
    observer.setConnected()

    await vi.advanceTimersByTimeAsync(CAMERA_EVIDENCE_TTL_MS + 2_000)

    expect(onEvidence).not.toHaveBeenCalled()
    expect(onStalled).toHaveBeenCalled()
  })

  it("marca stall si no existe getStats en el fallback", async () => {
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, { cancelVideoFrameCallback: undefined }, {})
    observer.setTrack(liveTrack())
    observer.setConnected()

    await vi.advanceTimersByTimeAsync(CAMERA_EVIDENCE_TTL_MS + 2_000)

    expect(onEvidence).not.toHaveBeenCalled()
    expect(onStalled).toHaveBeenCalled()
  })

  it("reinicia el TTL al recibir evidencia real antes del vencimiento", async () => {
    const media = makeVideo()
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, media.video, {})
    observer.setTrack(liveTrack())
    observer.setConnected()

    await vi.advanceTimersByTimeAsync(CAMERA_EVIDENCE_TTL_MS - 1_000)
    media.invoke(media.pending())
    await vi.advanceTimersByTimeAsync(4_000)

    expect(onEvidence).toHaveBeenCalledWith(CAMERA_EVIDENCE_TTL_MS - 1_000)
    expect(onStalled).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(CAMERA_EVIDENCE_TTL_MS - 1_000)
    expect(onStalled).toHaveBeenCalled()
  })

  it("dispose cancela callbacks, publicación pendiente y watchdog", async () => {
    const media = makeVideo()
    const onEvidence = vi.fn()
    const onStalled = vi.fn()
    const observer = createCameraObserver({ onEvidence, onStalled })
    observer.start(1, media.video, {})
    observer.setTrack(liveTrack())
    observer.setConnected()
    media.invoke(media.pending())
    await vi.advanceTimersByTimeAsync(999)
    media.invoke(media.pending())
    observer.dispose()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(onEvidence).toHaveBeenCalledTimes(1)
    expect(onStalled).not.toHaveBeenCalled()
    expect(media.video.cancelVideoFrameCallback).toHaveBeenCalled()
  })
})
