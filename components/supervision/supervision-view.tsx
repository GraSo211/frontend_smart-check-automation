"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Camera, CircleDot, LoaderCircle, RefreshCw, VideoOff } from "lucide-react"
import NodeSelector from "@/components/supervision/node-selector"
import LiveCamera from "@/components/supervision/live-camera"
import { Button } from "@/components/ui/button"
import { useMonitoringActions, useMonitoringNodes } from "@/components/monitoring-provider"
import { cameraNodesFromDevices } from "@/lib/camera-sources"

// The provider's own node request has an 8s timeout; after that we surface a
// retry instead of an endless spinner if the API never answered.
const LOAD_TIMEOUT_MS = 8_000

export default function SupervisionView() {
  const devices = useMonitoringNodes()
  const { refreshNodes } = useMonitoringActions()
  const cameraNodes = useMemo(() => cameraNodesFromDevices(devices), [devices])
  const [selectedNodeId, setSelectedNodeId] = useState("")
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const node = cameraNodes.find((item) => item.id === selectedNodeId) ?? cameraNodes[0] ?? null

  useEffect(() => {
    if (devices !== null || loadTimedOut) return
    const timer = window.setTimeout(() => setLoadTimedOut(true), LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [devices, loadTimedOut])

  const retry = () => {
    setLoadTimedOut(false)
    void refreshNodes()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-4">
        {devices === null ? (
          loadTimedOut ? <NodesError onRetry={retry} /> : <LoadingCameras />
        ) : node ? (
          <>
            <NodeSelector nodes={cameraNodes} selectedNodeId={node.id} onSelectNode={setSelectedNodeId} />
            <LiveCamera
              whepUrl={node.whepUrl}
              title={node.nombre}
              subtitle={node.ubicacion || "Nodo de supervisión"}
              videoAriaLabel={`Transmisión en vivo de la cámara de ${node.nombre}`}
            />
          </>
        ) : (
          <NoCameras />
        )}
      </div>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CircleDot className="size-4 text-accent" aria-hidden="true" />
            Fuente de video
          </div>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nodo</dt>
              <dd className="mt-0.5 break-words text-sm text-foreground">{node?.nombre ?? "Sin definir"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ubicación</dt>
              <dd className="mt-0.5 break-words text-sm text-foreground">{node?.ubicacion || "Sin definir"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cámara</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {node ? (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <Camera className="size-3.5" aria-hidden="true" />
                    Configurada
                  </span>
                ) : (
                  "Sin definir"
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <Camera className="size-3.5" aria-hidden="true" />
            Señal de baja latencia
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Estado operativo</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            La conexión se recupera automáticamente si la cámara pierde señal. Al cambiar de fuente se libera la sesión anterior.
          </p>
        </div>
      </aside>
    </div>
  )
}

function LoadingCameras() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 text-center" role="status">
      <LoaderCircle className="size-6 animate-spin text-info" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Cargando cámaras…</p>
    </div>
  )
}

function NoCameras() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary/70 text-muted-foreground">
        <VideoOff className="size-6" aria-hidden="true" />
      </span>
      <p className="font-heading text-base font-semibold text-foreground">Sin cámaras configuradas</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Ningún nodo tiene una URL WHEP configurada. Definí la URL de la cámara (WHEP) en la configuración del dispositivo desde{" "}
        <Link href="/nodos" className="font-medium text-primary underline-offset-4 hover:underline">
          Nodos
        </Link>
        .
      </p>
    </div>
  )
}

function NodesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center" role="alert">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <VideoOff className="size-6" aria-hidden="true" />
      </span>
      <p className="font-heading text-base font-semibold text-foreground">No se pudieron cargar los nodos</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        No pudimos obtener la lista de dispositivos. Revisá la conexión con la API e intentá de nuevo.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  )
}
