import { CAMERA_EVIDENCE_TTL_MS } from "@/lib/camera-health"

type TimerHandle = ReturnType<typeof globalThis.setTimeout>

type FrameVideo = {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
  onplaying?: ((event: Event) => unknown) | null
}

type StatsReport = {
  type?: string
  kind?: string
  mediaType?: string
  framesDecoded?: number
}

type StatsCollection = { forEach: (callback: (report: StatsReport) => void) => void }

type StatsPeer = { getStats?: () => Promise<StatsCollection> }

type TimerSetter = (callback: () => void, delay: number) => TimerHandle
type TimerCanceller = (handle: TimerHandle) => void

export type CameraObserverOptions = {
  now?: () => number
  setTimeout?: (callback: () => void, delay: number) => TimerHandle
  clearTimeout?: (handle: TimerHandle) => void
  setInterval?: (callback: () => void, delay: number) => TimerHandle
  clearInterval?: (handle: TimerHandle) => void
  onEvidence: (frameTimestamp: number) => void
  onReset?: () => void
  onStalled?: () => void
}

type FrameRequest = { generation: number; epoch: number; handle: number }

const STATS_INTERVAL_MS = 2_000

/**
 * Owns the small, imperative part of camera observation. Keeping epochs here
 * makes visibility changes invalidate both frame callbacks and in-flight
 * getStats results without making the component's JSX part of the protocol.
 */
export class CameraObserverController {
  private readonly now: () => number
  private readonly scheduleTimeout: TimerSetter
  private readonly cancelTimeout: TimerCanceller
  private readonly scheduleInterval: TimerSetter
  private readonly cancelInterval: TimerCanceller
  private readonly onEvidence: (frameTimestamp: number) => void
  private readonly onReset: () => void
  private onStalled: () => void

  private generation = 0
  private epoch = 0
  private visible = true
  private connected = false
  private track: MediaStreamTrack | null = null
  private video: FrameVideo | null = null
  private peer: StatsPeer | null = null
  private frameRequest: FrameRequest | null = null
  private statsTimer: TimerHandle | null = null
  private watchdogTimer: TimerHandle | null = null
  private statsInFlight: { generation: number; epoch: number } | null = null
  private previousFramesDecoded: number | null = null
  private observationStartedAt: number | null = null
  private lastEvidenceAt: number | null = null
  private lastPublishedWallTime: number | null = null
  private pendingPublish = false
  private pendingPublishVersion = 0
  private publishTimer: TimerHandle | null = null
  private disposed = false

  constructor(options: CameraObserverOptions) {
    this.now = options.now ?? Date.now
    this.scheduleTimeout = options.setTimeout ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
    this.cancelTimeout = options.clearTimeout ?? ((handle) => globalThis.clearTimeout(handle))
    this.scheduleInterval = options.setInterval ?? ((callback, delay) => globalThis.setInterval(callback, delay))
    this.cancelInterval = options.clearInterval ?? ((handle) => globalThis.clearInterval(handle))
    this.onEvidence = options.onEvidence
    this.onReset = options.onReset ?? (() => undefined)
    this.onStalled = options.onStalled ?? (() => undefined)
  }

  start(generation: number, video: FrameVideo | null, peer: StatsPeer | null) {
    this.stop(false)
    this.disposed = false
    this.generation = generation
    this.epoch += 1
    this.visible = true
    this.video = video
    this.peer = peer
    this.resetObservation()
    this.armFrame(generation, this.epoch)
    this.startTimers(generation, this.epoch)
  }

  setTrack(track: MediaStreamTrack | null) {
    this.track = track
    if (track && this.connected && this.visible) this.armFrame(this.generation, this.epoch)
  }

  setConnected() {
    if (this.disposed) return
    this.connected = true
    this.cancelFrame()
    this.cancelPublishTimer()
    this.epoch += 1
    this.resetObservation()
    this.startTimers(this.generation, this.epoch)
    // armFrame is idempotent: a callback already pending is the one callback
    // for this connection transition, never a second callback.
    this.armFrame(this.generation, this.epoch)
  }

  setDisconnected() {
    if (this.disposed) return
    this.connected = false
    this.cancelFrame()
    this.cancelPublishTimer()
    this.cancelObservationTimers()
    this.resetObservation()
  }

  setOnStalled(callback: () => void) {
    this.onStalled = callback
  }

  setVisibility(hidden: boolean) {
    if (this.disposed || hidden === !this.visible) return
    this.visible = !hidden
    this.epoch += 1
    this.cancelFrame()
    this.cancelPublishTimer()
    this.cancelObservationTimers()
    this.resetObservation()
    if (this.visible) {
      this.startTimers(this.generation, this.epoch)
      if (this.connected) this.armFrame(this.generation, this.epoch)
    }
  }

  recordFrame(frameTimestamp = this.now()) {
    if (!this.isActive(this.generation, this.epoch) || !this.hasLiveTrack()) return
    this.lastEvidenceAt = frameTimestamp
    this.publish(frameTimestamp)
  }

  stop(notify = true) {
    this.epoch += 1
    this.cancelFrame()
    this.cancelPublishTimer()
    this.cancelObservationTimers()
    this.statsInFlight = null
    if (this.video) this.video.onplaying = null
    this.video = null
    this.peer = null
    this.track = null
    this.connected = false
    this.observationStartedAt = null
    if (notify) this.resetObservation()
  }

  dispose() {
    this.disposed = true
    this.stop(false)
  }

  private isActive(generation: number, epoch: number) {
    return !this.disposed && this.visible && this.connected && generation === this.generation && epoch === this.epoch
  }

  private isCurrentVisibleEpoch(generation: number, epoch: number) {
    return !this.disposed && this.visible && generation === this.generation && epoch === this.epoch
  }

  private hasLiveTrack() {
    return this.track?.kind === "video" && this.track.readyState === "live"
  }

  private resetObservation() {
    this.previousFramesDecoded = null
    this.observationStartedAt = this.visible ? this.now() : null
    this.lastEvidenceAt = null
    this.lastPublishedWallTime = null
    this.pendingPublish = false
    this.pendingPublishVersion += 1
    this.onReset()
  }

  private armFrame(generation: number, epoch: number) {
    const video = this.video
    if (!video?.requestVideoFrameCallback || this.frameRequest || !this.visible) return
    const handle = video.requestVideoFrameCallback(() => {
      const request = this.frameRequest
      // An old callback must not clear the handle belonging to a newer one.
      if (!request || request.handle !== handle || request.generation !== generation || request.epoch !== epoch) return
      this.frameRequest = null
      if (!this.isCurrentVisibleEpoch(generation, epoch)) return
      // A frame can arrive before the transport's connected event. It is not
      // evidence yet, but it must not terminate the callback chain.
      if (this.connected && this.hasLiveTrack()) this.recordFrame(this.now())
      this.armFrame(generation, epoch)
    })
    this.frameRequest = { generation, epoch, handle }
  }

  private cancelFrame() {
    const request = this.frameRequest
    if (request && this.video?.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(request.handle)
    this.frameRequest = null
  }

  private startTimers(generation: number, epoch: number) {
    this.cancelObservationTimers()
    const video = this.video
    if (video && !video.requestVideoFrameCallback && this.peer?.getStats) {
      video.onplaying = () => { void this.pollStats(generation, epoch) }
      this.statsTimer = this.scheduleInterval(() => { void this.pollStats(generation, epoch) }, STATS_INTERVAL_MS)
    }
    this.watchdogTimer = this.scheduleInterval(() => this.watchdog(generation, epoch), 2_000)
  }

  private cancelObservationTimers() {
    if (this.statsTimer !== null) this.cancelInterval(this.statsTimer)
    if (this.watchdogTimer !== null) this.cancelInterval(this.watchdogTimer)
    this.statsTimer = null
    this.watchdogTimer = null
  }

  private async pollStats(generation: number, epoch: number) {
    const peer = this.peer
    if (!peer?.getStats || !this.isActive(generation, epoch)) return
    if (this.statsInFlight?.generation === generation && this.statsInFlight.epoch === epoch) return
    const request = { generation, epoch }
    this.statsInFlight = request
    try {
      const stats = await peer.getStats()
      if (!this.isActive(generation, epoch) || this.statsInFlight !== request) return
      let framesDecoded: number | null = null
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && (report.kind === "video" || report.mediaType === "video") && typeof report.framesDecoded === "number") {
          framesDecoded = report.framesDecoded
        }
      })
      if (framesDecoded !== null && this.previousFramesDecoded !== null && framesDecoded > this.previousFramesDecoded) this.recordFrame(this.now())
      if (framesDecoded !== null) this.previousFramesDecoded = framesDecoded
    } catch {
      // The peer can close between two polls; the connection state owns retry.
    } finally {
      if (this.statsInFlight === request) this.statsInFlight = null
    }
  }

  private watchdog(generation: number, epoch: number) {
    if (!this.isActive(generation, epoch) || this.observationStartedAt === null) return
    const reference = this.lastEvidenceAt ?? this.observationStartedAt
    if (this.now() - reference > CAMERA_EVIDENCE_TTL_MS) this.onStalled()
  }

  private publish(frameTimestamp: number) {
    const wallTime = this.now()
    const elapsed = this.lastPublishedWallTime === null ? Infinity : wallTime - this.lastPublishedWallTime
    if (elapsed < 1_000) {
      this.pendingPublish = true
      ++this.pendingPublishVersion
      if (this.publishTimer === null) {
        this.publishTimer = this.scheduleTimeout(() => {
          this.publishTimer = null
          if (!this.pendingPublish) return
          this.pendingPublish = false
          this.publish(this.lastEvidenceAt ?? frameTimestamp)
        }, Math.max(1, 1_000 - elapsed))
      }
      return
    }
    this.pendingPublish = false
    this.lastPublishedWallTime = wallTime
    this.onEvidence(frameTimestamp)
  }

  private cancelPublishTimer() {
    if (this.publishTimer !== null) this.cancelTimeout(this.publishTimer)
    this.publishTimer = null
    this.pendingPublish = false
    this.pendingPublishVersion += 1
  }
}

export function createCameraObserver(options: CameraObserverOptions) {
  return new CameraObserverController(options)
}
