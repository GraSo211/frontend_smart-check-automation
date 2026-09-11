// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ reportCamera: vi.fn() }))

vi.mock("@/components/monitoring-provider", () => ({
  useMonitoringActions: () => ({ reportCamera: mocks.reportCamera }),
}))

import LiveCamera from "@/components/supervision/live-camera"

type FrameCallback = (now: number, metadata: unknown) => void

class FakeRTCPeerConnection {
  static instances: FakeRTCPeerConnection[] = []
  connectionState = "new"
  iceConnectionState = "new"
  iceGatheringState = "complete"
  localDescription: { sdp: string } | null = null
  ontrack: ((event: { track: MediaStreamTrack; streams: unknown[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  oniceconnectionstatechange: (() => void) | null = null
  close = vi.fn(() => { this.connectionState = "closed" })
  constructor() { FakeRTCPeerConnection.instances.push(this) }
  addTransceiver = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" }))
  setLocalDescription = vi.fn(async (description: { sdp: string }) => { this.localDescription = description })
  setRemoteDescription = vi.fn(async () => undefined)
  emitConnection(state: string) {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }
  emitTrack(track: MediaStreamTrack, stream: unknown) {
    this.ontrack?.({ track, streams: [stream] })
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function response(location?: string) {
  return {
    ok: true,
    status: 201,
    headers: { get: (name: string) => name.toLowerCase() === "location" ? location ?? null : null },
    text: async () => "answer-sdp",
  } as unknown as Response
}

function liveTrack() {
  return {
    kind: "video",
    readyState: "live",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack
}

let frameHandle = 0
let frameCallbacks = new Map<number, FrameCallback>()
let fetchMock: ReturnType<typeof vi.fn>
let originalFrameCallback: PropertyDescriptor | undefined
let originalCancelFrameCallback: PropertyDescriptor | undefined

function video() {
  return screen.getByLabelText("Transmisión en vivo de la cámara principal") as HTMLVideoElement
}

function emitFrame() {
  const handle = Math.max(...frameCallbacks.keys())
  frameCallbacks.get(handle)?.(0, {})
}

async function finishTransport() {
  await act(async () => undefined)
  const peer = FakeRTCPeerConnection.instances[0]
  peer.emitConnection("connected")
  peer.emitTrack(liveTrack(), {})
  fireEvent(video(), new Event("playing"))
  await act(async () => undefined)
  return peer
}

describe("LiveCamera integración", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeRTCPeerConnection.instances = []
    frameHandle = 0
    frameCallbacks = new Map()
    originalFrameCallback = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, "requestVideoFrameCallback")
    originalCancelFrameCallback = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, "cancelVideoFrameCallback")
    Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", {
      configurable: true,
      writable: true,
      value: vi.fn((callback: FrameCallback) => {
        const handle = ++frameHandle
        frameCallbacks.set(handle, callback)
        return handle
      }),
    })
    Object.defineProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection)
    fetchMock = vi.fn(() => Promise.resolve(response()))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    if (originalFrameCallback) Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", originalFrameCallback)
    else delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).requestVideoFrameCallback
    if (originalCancelFrameCallback) Object.defineProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback", originalCancelFrameCallback)
    else delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).cancelVideoFrameCallback
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("no considera SDP ni POST exitoso como cámara en línea", async () => {
    render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/whep" }))
    await act(async () => undefined)
    expect(fetchMock).toHaveBeenCalledWith("https://camera.test/whep", expect.objectContaining({ method: "POST" }))
    expect(screen.getByRole("status").textContent).toContain("Conectando")
    expect(mocks.reportCamera).not.toHaveBeenCalledWith(expect.objectContaining({ availability: "available" }))
  })

  it("no considera conectado con track y playing si todavía no llegó un frame", async () => {
    render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/whep" }))
    await finishTransport()
    expect(screen.getByRole("status").textContent).not.toContain("En vivo")
    expect(mocks.reportCamera).not.toHaveBeenCalledWith(expect.objectContaining({ availability: "available" }))
  })

  it("reconecta si el watchdog real detecta diez segundos sin frames", async () => {
    vi.useFakeTimers()
    render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/whep" }))
    await finishTransport()
    await act(async () => { await vi.advanceTimersByTimeAsync(12_001) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(FakeRTCPeerConnection.instances[0].close).toHaveBeenCalled()
    expect(FakeRTCPeerConnection.instances).toHaveLength(2)
  })

  it("promueve sólo un frame real, reporta streaming y conserva fullscreen sin control de audio", async () => {
    render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/whep" }))
    await finishTransport()
    const requestFullscreen = vi.fn()
    Object.defineProperty(video(), "requestFullscreen", { configurable: true, value: requestFullscreen })
    await act(async () => emitFrame())
    expect(screen.getByRole("status").textContent).toContain("En vivo")
    expect(screen.getByText("streaming activo")).toBeTruthy()
    expect(screen.getByLabelText("Sin audio").tagName).toBe("SPAN")
    expect(screen.queryByRole("button", { name: "Audio silenciado" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }))
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(mocks.reportCamera).toHaveBeenCalledWith(expect.objectContaining({ availability: "available" }))
  })

  it("aborta el POST a los ocho segundos, libera el peer y reintenta", async () => {
    vi.useFakeTimers()
    const post = deferred<Response>()
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted")
          error.name = "AbortError"
          post.reject(error)
        })
        return post.promise
      }
      return Promise.resolve(response())
    })
    render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/whep" }))
    await act(async () => undefined)
    const firstPeer = FakeRTCPeerConnection.instances[0]
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(7_999) })
    expect(firstPeer.close).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(firstPeer.close).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(FakeRTCPeerConnection.instances).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([url, init]) => url === "https://camera.test/whep" && init.method === "POST")).toHaveLength(2)
  })

  it("cierra y limpia localmente antes de que termine DELETE y luego vuelve a publicar", async () => {
    vi.useFakeTimers()
    const pendingDelete = deferred<Response>()
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (init.method === "DELETE") return pendingDelete.promise
      return Promise.resolve(response("https://camera.test/session/1"))
    })
    render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/whep" }))
    const peer = await finishTransport()
    const currentVideo = video()
    peer.emitConnection("failed")
    await act(async () => undefined)
    expect(peer.close).toHaveBeenCalledTimes(1)
    expect(currentVideo.srcObject).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("https://camera.test/session/1", expect.objectContaining({ method: "DELETE" }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(2)
    pendingDelete.resolve(response())
  })

  it("invalida la señalización pendiente al desmontar o cambiar URL", async () => {
    const first = deferred<Response>()
    fetchMock.mockReturnValueOnce(first.promise).mockResolvedValue(response())
    const rendered = render(React.createElement(LiveCamera, { whepUrl: "https://camera.test/one" }))
    await act(async () => undefined)
    const oldPeer = FakeRTCPeerConnection.instances[0]
    const oldFrameHandle = Math.max(...frameCallbacks.keys())
    rendered.rerender(React.createElement(LiveCamera, { whepUrl: "https://camera.test/two" }))
    await act(async () => undefined)
    expect(oldPeer.close).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith("https://camera.test/two", expect.objectContaining({ method: "POST" }))
    first.resolve(response("https://camera.test/stale"))
    await act(async () => undefined)
    await act(async () => frameCallbacks.get(oldFrameHandle)?.(0, {}))
    expect(oldPeer.setRemoteDescription).not.toHaveBeenCalled()
    expect(mocks.reportCamera).not.toHaveBeenCalledWith(expect.objectContaining({ availability: "available" }))
    rendered.unmount()
  })
})
