"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, LoaderCircle, Maximize, Radio, RefreshCw, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"

export type CameraStatus = "connecting" | "online" | "offline" | "reconnecting" | "error"

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000]

export function getReconnectDelay(attempt: number) {
  return RECONNECT_DELAYS[Math.min(Math.max(attempt, 0), RECONNECT_DELAYS.length - 1)]
}

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

type LiveCameraProps = { whepUrl?: string }

export default function LiveCamera({ whepUrl = process.env.NEXT_PUBLIC_MEDIAMTX_WHEP_URL }: LiveCameraProps) {
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
  const [status, setStatus] = useState<CameraStatus>(whepUrl ? "connecting" : "offline")

  const releaseSession = useCallback(async (pc: RTCPeerConnection | null, controller: AbortController | null, location: string | null) => {
    controller?.abort()
    if (location) {
      try { await fetch(location, { method: "DELETE", keepalive: true }) } catch { /* La sesión ya puede haber expirado. */ }
    }
    if (pc && pc.connectionState !== "closed") pc.close()
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !whepUrl || retryTimerRef.current !== null) return
    const attempt = attemptRef.current
    setStatus(attempt === 0 ? "offline" : "reconnecting")
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      attemptRef.current += 1
      void connectRef.current?.()
    }, getReconnectDelay(attempt))
  }, [whepUrl])

  const connect = useCallback(async () => {
    if (!mountedRef.current || !whepUrl || pcRef.current) return
    const generation = ++generationRef.current
    const controller = new AbortController()
    const pc = new RTCPeerConnection()
    pcRef.current = pc
    controllerRef.current = controller
    setStatus(attemptRef.current ? "reconnecting" : "connecting")
    pc.addTransceiver("video", { direction: "recvonly" })
    pc.ontrack = (event) => {
      if (generation === generationRef.current && videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0]
      }
    }

    const failed = () => {
      if (generation !== generationRef.current) return
      const isDisconnected = pc.connectionState === "disconnected" || pc.iceConnectionState === "disconnected"
      const isFailed = pc.connectionState === "failed" || pc.connectionState === "closed" || pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed"
      if (!isDisconnected && !isFailed) return
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
        setStatus(pc.connectionState === "failed" || pc.connectionState === "closed" ? "error" : "offline")
        scheduleReconnect()
      })
    }
    pc.onconnectionstatechange = failed
    pc.oniceconnectionstatechange = failed

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIceComplete(pc)
      const response = await fetch(whepUrl, {
        method: "POST", headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
        body: pc.localDescription?.sdp, signal: controller.signal,
      })
      if (!response.ok) throw new Error(`WHEP respondió ${response.status}`)
      const location = response.headers.get("Location")
      locationRef.current = location ? new URL(location, whepUrl).toString() : null
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() })
      if (generation === generationRef.current) { attemptRef.current = 0; setStatus("online") }
    } catch {
      if (controller.signal.aborted || generation !== generationRef.current) return
      if (cleanupGenerationRef.current === generation) return
      cleanupGenerationRef.current = generation
      void releaseSession(pc, controller, locationRef.current).finally(() => {
        if (generation !== generationRef.current) return
        pcRef.current = null; controllerRef.current = null; locationRef.current = null
        setStatus("error"); scheduleReconnect()
      })
    }
  }, [releaseSession, scheduleReconnect, whepUrl])

  useEffect(() => {
    connectRef.current = connect
    return () => {
      if (connectRef.current === connect) connectRef.current = null
    }
  }, [connect])

  useEffect(() => {
    mountedRef.current = true
    if (whepUrl) void connect()
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      if (disconnectTimerRef.current !== null) window.clearTimeout(disconnectTimerRef.current)
      void releaseSession(pcRef.current, controllerRef.current, locationRef.current)
      pcRef.current = null; controllerRef.current = null; locationRef.current = null
    }
  }, [connect, releaseSession, whepUrl])

  const isActive = status === "online"
  const configurationMissing = !whepUrl
  const statusLabel = { connecting: "Conectando", online: "En vivo", offline: "Fuera de línea", reconnecting: "Reconectando", error: "Error de conexión" }[status]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_60px_-30px_color-mix(in_oklab,var(--primary)_45%,transparent)]" aria-label="Cámara de producción">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Camera className="size-4" aria-hidden="true" /></span><div><h2 className="font-heading text-sm font-semibold">Cámara principal</h2><p className="text-xs text-muted-foreground">Línea de producción · Planta 01</p></div></div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isActive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`} role="status"><span className={`size-1.5 rounded-full ${isActive ? "animate-pulse bg-success" : "bg-current"}`} />{statusLabel}</span>
      </div>
      <div className="relative aspect-video min-h-[260px] bg-video-surface sm:min-h-[380px]">
        <video ref={videoRef} autoPlay muted playsInline className={`size-full object-cover ${isActive ? "opacity-100" : "opacity-20"}`} aria-label="Transmisión en vivo de la cámara principal" />
        {!isActive && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-video-foreground"><span className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-video-foreground/10 bg-video-foreground/10"><AlertTriangle className="size-6 text-warning" aria-hidden="true" /></span><p className="font-heading text-lg font-semibold">{configurationMissing ? "Configuración pendiente" : status === "reconnecting" || status === "connecting" ? "Buscando señal…" : "Cámara fuera de línea"}</p><p className="mt-1 max-w-sm text-sm text-video-foreground/75">{configurationMissing ? "Definí NEXT_PUBLIC_MEDIAMTX_WHEP_URL para habilitar esta transmisión." : status === "error" ? "Reintentaremos la conexión automáticamente." : "La transmisión aparecerá aquí cuando esté disponible."}</p>{status === "offline" && !configurationMissing && <Button onClick={() => { attemptRef.current = 0; void connect() }} variant="secondary" size="sm" className="mt-5"><RefreshCw className="size-3.5" /> Reintentar ahora</Button>}{(status === "connecting" || status === "reconnecting") && <LoaderCircle className="mt-5 size-5 animate-spin text-info" aria-label="Cargando" />}</div>}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-video-overlay px-2.5 py-1.5 text-[11px] text-video-foreground backdrop-blur-sm"><Radio className="size-3 text-info" /> WHEP / baja latencia</div>
        {isActive && <div className="absolute bottom-3 right-3 flex gap-1.5"><button type="button" className="rounded-lg bg-video-overlay p-2 text-video-foreground backdrop-blur-sm transition hover:bg-foreground/75" aria-label="Audio silenciado"><VolumeX className="size-4" /></button><button type="button" onClick={() => videoRef.current?.requestFullscreen()} className="rounded-lg bg-video-overlay p-2 text-video-foreground backdrop-blur-sm transition hover:bg-foreground/75" aria-label="Pantalla completa"><Maximize className="size-4" /></button></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-5"><span>Señal monitoreada automáticamente</span><span className="font-mono text-[10px] uppercase tracking-wider">{isActive ? "streaming activo" : "sin señal"}</span></div>
    </section>
  )
}
