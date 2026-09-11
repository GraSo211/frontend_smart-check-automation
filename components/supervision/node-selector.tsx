"use client"

import { Camera, MapPin } from "lucide-react"
import SegmentedControl from "@/components/supervision/segmented-control"
import type { CameraNode } from "@/lib/camera-sources"

type NodeSelectorProps = {
  nodes: CameraNode[]
  selectedNodeId: string
  onSelectNode: (id: string) => void
}

/**
 * Selector de la fuente de video. Cada nodo (Raspberry) expone una sola
 * cámara, así que el control segmentado cambia de nodo. Con un solo nodo se
 * muestra como contexto, sin un selector de un único ítem.
 */
export default function NodeSelector({ nodes, selectedNodeId, onSelectNode }: NodeSelectorProps) {
  const node = nodes.find((item) => item.id === selectedNodeId) ?? nodes[0]
  if (!node) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Camera className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold text-foreground">{node.nombre}</p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              {node.ubicacion ? <MapPin className="size-3 shrink-0" aria-hidden="true" /> : null}
              {node.ubicacion || "Sin ubicación"}
            </p>
          </div>
        </div>
        {nodes.length > 1 && (
          <SegmentedControl
            label="Nodo de la cámara"
            options={nodes.map((item) => ({ id: item.id, label: item.nombre }))}
            value={node.id}
            onChange={onSelectNode}
          />
        )}
      </div>
    </div>
  )
}
