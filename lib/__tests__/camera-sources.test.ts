import { describe, expect, it } from "vitest"
import { cameraNodesFromDevices, isWhepUrl } from "@/lib/camera-sources"
import type { Device } from "@/lib/devices-data"

function device(overrides: Partial<Device> & { dispositivoId: string }): Device {
  return {
    nombre: "Nodo",
    ubicacion: "Línea",
    estado: "offline",
    lastSeen: "",
    ...overrides,
  }
}

describe("cameraNodesFromDevices", () => {
  it("mapea sólo los dispositivos con whepUrl y preserva el orden", () => {
    const devices: Device[] = [
      device({ dispositivoId: "n-1", nombre: "Raspberry Entrada", ubicacion: "Entrada del horno", whepUrl: "https://cam.test/entrada/whep" }),
      device({ dispositivoId: "n-2", nombre: "Sin cámara", ubicacion: "Depósito" }),
      device({ dispositivoId: "n-3", nombre: "Raspberry Salida", ubicacion: "Salida del horno", whepUrl: "https://cam.test/salida/whep" }),
    ]

    expect(cameraNodesFromDevices(devices)).toEqual([
      { id: "n-1", nombre: "Raspberry Entrada", ubicacion: "Entrada del horno", whepUrl: "https://cam.test/entrada/whep" },
      { id: "n-3", nombre: "Raspberry Salida", ubicacion: "Salida del horno", whepUrl: "https://cam.test/salida/whep" },
    ])
  })

  it("devuelve [] para null, lista vacía o dispositivos sin cámara", () => {
    expect(cameraNodesFromDevices(null)).toEqual([])
    expect(cameraNodesFromDevices([])).toEqual([])
    expect(cameraNodesFromDevices([device({ dispositivoId: "n-1" })])).toEqual([])
  })

  it("normaliza el whepUrl con trim y descarta los vacíos", () => {
    const nodes = cameraNodesFromDevices([
      device({ dispositivoId: "n-1", whepUrl: "  https://cam.test/whep  " }),
      device({ dispositivoId: "n-2", whepUrl: "   " }),
    ])

    expect(nodes).toEqual([
      { id: "n-1", nombre: "Nodo", ubicacion: "Línea", whepUrl: "https://cam.test/whep" },
    ])
  })
})

describe("isWhepUrl", () => {
  it("acepta URLs http(s) que terminan en /whep", () => {
    expect(isWhepUrl("https://mediamtx.local/entrada/whep")).toBe(true)
    expect(isWhepUrl("http://10.0.0.5:8889/horno/whep")).toBe(true)
    expect(isWhepUrl("  https://mediamtx.local/cam/whep?token=abc  ")).toBe(true)
  })

  it("rechaza otros protocolos, paths o valores inválidos", () => {
    expect(isWhepUrl("ftp://mediamtx.local/whep")).toBe(false)
    expect(isWhepUrl("https://mediamtx.local/entrada")).toBe(false)
    expect(isWhepUrl("https://mediamtx.local/whep/")).toBe(false)
    expect(isWhepUrl("no-es-una-url")).toBe(false)
  })

  it("trata el campo vacío como válido porque es opcional", () => {
    expect(isWhepUrl("")).toBe(true)
    expect(isWhepUrl("   ")).toBe(true)
  })
})
