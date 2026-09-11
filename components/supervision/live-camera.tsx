"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, LoaderCircle, Maximize, Radio, RefreshCw, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMonitoringActions } from "@/components/monitoring-provider"
import { getCameraHealth, getReconnectDelay, isCurrentCameraGeneration, startCameraSessionDelete } from "@/lib/camera-health"
import { createCameraObserver } from "@/lib/camera-observer"

export type CameraStatus = "connecting" | "online" | "offline" | "reconnecting" | "error" | "unknown"
export { getReconnectDelay } from "@/lib/camera-health"

function waitForIceComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  return new Promise<void>((resolve) => {
    const finish = () => {
      if (pc.iceGatheringState !== "complete") return
      pc.removeEventListener("icegatheringstatechange", finish)
      window.clearTimeout(timeout)
      resolve()
    }
    const timeout = window.setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", finish)
      resolve()
    }, 8000)
    pc.addEventListener("icegatheringstatechange", finish)
    // Do not leave a connection waiting forever when a browser cannot gather ICE.
  })
}

type LiveCameraProps = {
  whepUrl?: string
  title?: string
  subtitle?: string
  location?: string
  videoAriaLabel?: string
}

export default function LiveCamera({
  whepUrl,
  title = "Cámara principal",
  subtitle = "Línea de producción · Planta 01",
  location,
  videoAriaLabel = "Transmisión en vivo de la cámara principal",
}: LiveCameraProps) {
  const { reportCamera } = useMonitoringActions()
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const locationRef = useRef<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const disconnectTimerRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const cleanupGenerationRef = useRef<number | null>(null)
  const connectRef = useRef<(() => Promise<void>) | null>(null)
  const attemptRef = useRef(0)
  const mountedRef = useRef(false)
  const hiddenRef = useRef(false)
  const peerConnectedRef = useRef(false)
  const trackEndedRef = useRef(false)
  const failureHandlerRef = useRef<((force?: boolean) => void) | null>(null)
  const trackEndedHandlerRef = useRef<(() => void) | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [lastEvidenceAt, setLastEvidenceAt] = useState<number | null>(null)
  const [status, setStatus] = useState<CameraStatus>(whepUrl ? "connecting" : "unknown")

  const [observer] = useState(() => createCameraObserver({
      onEvidence: (evidenceAt) => {
        setLastEvidenceAt(evidenceAt)
        setStatus("online")
      },
      onReset: () => setLastEvidenceAt(null),
      onStalled: () => setStatus("reconnecting"),
    }))

  const releaseSession = useCallback((pc: RTCPeerConnection | null, controller: AbortController | null, location: string | null) => {
    observer.stop(false)
    controller?.abort()
    if (pc && pc.connectionState !== "closed") pc.close()
    if (trackRef.current && trackEndedHandlerRef.current) trackRef.current.removeEventListener("ended", trackEndedHandlerRef.current)
    trackRef.current = null
    trackEndedHandlerRef.current = null
    if (videoRef.current) {
      videoRef.current.onplaying = null
      videoRef.current.srcObject = null
    }
    if (location) {
      startCameraSessionDelete(location)
    }
    return Promise.resolve()
  }, [observer])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || hiddenRef.current || !whepUrl || retryTimerRef.current !== null) return
    const attempt = attemptRef.current
    setStatus(attempt === 0 ? "offline" : "reconnecting")
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      attemptRef.current += 1
      void connectRef.current?.()
    }, getReconnectDelay(attempt))
  }, [setStatus, whepUrl])

  const connect = useCallback(async () => {
    if (!mountedRef.current || hiddenRef.current || !whepUrl || pcRef.current) return
    const generation = ++generationRef.current
    const controller = new AbortController()
    const pc = new RTCPeerConnection()
    const isCurrentSession = () => isCurrentCameraGeneration(generation, generationRef.current) && pcRef.current === pc && controllerRef.current === controller
    pcRef.current = pc
    controllerRef.current = controller
    setStatus(attemptRef.current ? "reconnecting" : "connecting")
    peerConnectedRef.current = false
    trackEndedRef.current = false
    observer.start(generation, videoRef.current, pc)
    pc.addTransceiver("video", { direction: "recvonly" })
    pc.ontrack = (event) => {
      if (!isCurrentCameraGeneration(generation, generationRef.current) || !videoRef.current || !event.streams[0]) return
      videoRef.current.srcObject = event.streams[0]
      if (trackRef.current && trackEndedHandlerRef.current) trackRef.current.removeEventListener("ended", trackEndedHandlerRef.current)
      trackRef.current = event.track
      observer.setTrack(event.track)
      trackEndedRef.current = event.track.readyState === "ended"
      const onTrackEnded = () => {
        if (!isCurrentCameraGeneration(generation, generationRef.current)) return
        trackEndedRef.current = true
        setStatus("offline")
        failureHandlerRef.current?.()
      }
      trackEndedHandlerRef.current = onTrackEnded
      event.track.addEventListener("ended", onTrackEnded)
      if (trackEndedRef.current) {
        setStatus("offline")
        failureHandlerRef.current?.()
      }
    }

    const failed = (force = false) => {
      if (generation !== generationRef.current) return
      const isDisconnected = pc.connectionState === "disconnected" || pc.iceConnectionState === "disconnected"
      const actualFailure = trackEndedRef.current || pc.connectionState === "failed" || pc.connectionState === "closed" || pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed"
      const isFailed = force || actualFailure
      if (!isDisconnected && !isFailed) return
      peerConnectedRef.current = false
      observer.setDisconnected()
      trackEndedRef.current = actualFailure
      setLastEvidenceAt(null)
      setStatus(force ? "reconnecting" : "offline")
      if (isFailed && disconnectTimerRef.current !== null) {
        window.clearTimeout(disconnectTimerRef.current)
        disconnectTimerRef.current = null
      }
      if (isDisconnected && !isFailed) {
        if (disconnectTimerRef.current === null) {
          disconnectTimerRef.current = window.setTimeout(() => {
            disconnectTimerRef.current = null
            if (generation === generationRef.current && (pc.connectionState === "disconnected" || pc.iceConnectionState === "disconnected")) {
              cleanupGenerationRef.current = generation
              void releaseSession(pc, controller, locationRef.current).finally(() => {
                if (generation !== generationRef.current) return
                pcRef.current = null
                controllerRef.current = null
                locationRef.current = null
                setStatus("offline")
                scheduleReconnect()
              })
            }
          }, 3500)
        }
        return
      }
      if (cleanupGenerationRef.current === generation) return
      cleanupGenerationRef.current = generation
      void releaseSession(pc, controller, locationRef.current).finally(() => {
        if (generation !== generationRef.current) return
        pcRef.current = null
        controllerRef.current = null
        locationRef.current = null
        disconnectTimerRef.current = null
        setStatus("offline")
        scheduleReconnect()
      })
    }
    observer.setOnStalled(() => failed(true))
    failureHandlerRef.current = failed
    pc.onconnectionstatechange = () => {
      if (generation !== generationRef.current) return
      if (pc.connectionState === "connected") {
        peerConnectedRef.current = true
        if (disconnectTimerRef.current !== null) {
          window.clearTimeout(disconnectTimerRef.current)
          disconnectTimerRef.current = null
        }
        observer.setConnected()
      }
      failed()
    }
    pc.oniceconnectionstatechange = () => failed()

    let whepTimeout: number | null = null
    try {
      const offer = await pc.createOffer()
      if (!isCurrentSession()) return
      await pc.setLocalDescription(offer)
      if (!isCurrentSession()) return
      await waitForIceComplete(pc)
      if (!isCurrentSession()) return
      whepTimeout = window.setTimeout(() => controller.abort(), 8000)
      const response = await fetch(whepUrl, {
        method: "POST", headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
        body: pc.localDescription?.sdp, signal: controller.signal,
      })
      if (!isCurrentSession()) return
      if (!response.ok) throw new Error(`WHEP respondió ${response.status}`)
      const location = response.headers.get("Location")
      locationRef.current = location ? new URL(location, whepUrl).toString() : null
      const answer = await response.text()
      if (!isCurrentSession()) return
      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      if (isCurrentSession()) attemptRef.current = 0
    } catch {
      if (generation !== generationRef.current) return
      if (cleanupGenerationRef.current === generation) return
      cleanupGenerationRef.current = generation
      void releaseSession(pc, controller, locationRef.current).finally(() => {
        if (generation !== generationRef.current) return
        pcRef.current = null; controllerRef.current = null; locationRef.current = null
        setStatus("error"); scheduleReconnect()
      })
    } finally {
      if (whepTimeout !== null) window.clearTimeout(whepTimeout)
    }
  }, [observer, releaseSession, scheduleReconnect, setLastEvidenceAt, setStatus, whepUrl])

  useEffect(() => {
    connectRef.current = connect
    return () => {
      if (connectRef.current === connect) connectRef.current = null
    }
  }, [connect])

  useEffect(() => {
    mountedRef.current = true
    hiddenRef.current = typeof document !== "undefined" && document.visibilityState === "hidden"
    if (whepUrl) void connect()
    const onVisibilityChange = () => {
      hiddenRef.current = document.visibilityState === "hidden"
      if (hiddenRef.current) {
        if (retryTimerRef.current !== null) {
          window.clearTimeout(retryTimerRef.current)
          retryTimerRef.current = null
        }
        observer.setVisibility(true)
        setStatus("unknown")
        return
      }
      // Evidence from before a background interval is not enough to recover.
      observer.setVisibility(false)
      setStatus(whepUrl ? "connecting" : "unknown")
      if (!pcRef.current) void connectRef.current?.()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      hiddenRef.current = true
      observer.dispose()
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      if (disconnectTimerRef.current !== null) window.clearTimeout(disconnectTimerRef.current)
      failureHandlerRef.current = null
      document.removeEventListener("visibilitychange", onVisibilityChange)
      reportCamera({ availability: "unknown", checkedAt: null, detail: "Sin reproducción activa" })
      void releaseSession(pcRef.current, controllerRef.current, locationRef.current)
      pcRef.current = null; controllerRef.current = null; locationRef.current = null
    }
  }, [connect, observer, releaseSession, reportCamera, whepUrl])

  useEffect(() => {
    const report = getCameraHealth({
      mounted: mountedRef.current && !hiddenRef.current,
      configured: Boolean(whepUrl),
      peerConnected: peerConnectedRef.current,
      trackLive: trackRef.current?.readyState === "live",
      trackEnded: trackEndedRef.current,
      connectionFailed: status === "offline" || status === "error",
      lastEvidenceAt,
    })
    if (status === "reconnecting" && report.availability !== "disconnected") {
      reportCamera({ ...report, availability: "degraded", detail: "Sin progreso de video" })
      return
    }
    reportCamera(report)
  }, [lastEvidenceAt, reportCamera, status, whepUrl])

  const isActive = status === "online"
  const configurationMissing = !whepUrl
  const statusLabel = { connecting: "Conectando", online: "En vivo", offline: "Fuera de línea", reconnecting: "Reconectando", error: "Error de conexión", unknown: "Estado desconocido" }[status]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_60px_-30px_color-mix(in_oklab,var(--primary)_45%,transparent)]" aria-label="Cámara de producción">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Camera className="size-4" aria-hidden="true" /></span><div><h2 className="font-heading text-sm font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p>{location ? <p className="mt-0.5 text-[11px] text-muted-foreground">{location}</p> : null}</div></div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isActive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`} role="status"><span className={`size-1.5 rounded-full ${isActive ? "animate-pulse bg-success" : "bg-current"}`} />{statusLabel}</span>
      </div>
      <div className="relative aspect-video min-h-[260px] bg-video-surface sm:min-h-[380px]">
        <video ref={videoRef} autoPlay muted playsInline className={`size-full object-cover ${isActive ? "opacity-100" : "opacity-20"}`} aria-label={videoAriaLabel} />
        {!isActive && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-video-foreground"><span className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-video-foreground/10 bg-video-foreground/10"><AlertTriangle className="size-6 text-warning" aria-hidden="true" /></span><p className="font-heading text-lg font-semibold">{configurationMissing ? "Configuración pendiente" : status === "reconnecting" || status === "connecting" ? "Buscando señal…" : "Cámara fuera de línea"}</p><p className="mt-1 max-w-sm text-sm text-video-foreground/75">{configurationMissing ? "Configurá la URL WHEP (cámara) del nodo para habilitar esta transmisión." : status === "error" ? "Reintentaremos la conexión automáticamente." : "La transmisión aparecerá aquí cuando esté disponible."}</p>{status === "offline" && !configurationMissing && <Button onClick={() => { attemptRef.current = 0; void connect() }} variant="secondary" size="sm" className="mt-5"><RefreshCw className="size-3.5" /> Reintentar ahora</Button>}{(status === "connecting" || status === "reconnecting") && <LoaderCircle className="mt-5 size-5 animate-spin text-info" aria-label="Cargando" />}</div>}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-video-overlay px-2.5 py-1.5 text-[11px] text-video-foreground backdrop-blur-sm"><Radio className="size-3 text-info" /> WHEP / baja latencia</div>
        {isActive && <div className="absolute bottom-3 right-3 flex gap-1.5"><span className="inline-flex items-center gap-1.5 rounded-lg bg-video-overlay px-2.5 py-2 text-xs text-video-foreground backdrop-blur-sm" aria-label="Sin audio"><VolumeX className="size-4" aria-hidden="true" /><span>Sin audio</span></span><button type="button" onClick={() => videoRef.current?.requestFullscreen()} className="rounded-lg bg-video-overlay p-2 text-video-foreground backdrop-blur-sm transition hover:bg-foreground/75" aria-label="Pantalla completa"><Maximize className="size-4" /></button></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-5"><span>Señal monitoreada automáticamente</span><span className="font-mono text-[10px] uppercase tracking-wider">{isActive ? "streaming activo" : "sin señal"}</span></div>
    </section>
  )
}
