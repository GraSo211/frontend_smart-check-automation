import { describe, expect, it } from "vitest"
import { cameraNodesFromDevices, isWhepUrl } from "@/lib/camera-sources"
import type { Device } from "@/lib/devices-data"

function device(overrides: Partial<Device> & { dispositivoId: string }): Device {
  return {
    nombre: "Nodo",
    estado: "offline",
    lastSeen: "",
    ...overrides,
  }
}

describe("cameraNodesFromDevices", () => {
  it("mapea sólo los dispositivos con whepUrl y preserva el orden", () => {
    const devices: Device[] = [
      device({ dispositivoId: "n-1", nombre: "Raspberry Entrada", sectorId: "sec-1", whepUrl: "https://cam.test/entrada/whep" }),
      device({ dispositivoId: "n-2", nombre: "Sin cámara", sectorId: "sec-2" }),
      device({ dispositivoId: "n-3", nombre: "Raspberry Salida", sectorId: "sec-3", whepUrl: "https://cam.test/salida/whep" }),
    ]
    const sectorNames = new Map([
      ["sec-1", "Entrada del horno"],
      ["sec-3", "Salida del horno"],
    ])

    expect(cameraNodesFromDevices(devices, sectorNames)).toEqual([
      { id: "n-1", nombre: "Raspberry Entrada", sector: "Entrada del horno", whepUrl: "https://cam.test/entrada/whep" },
      { id: "n-3", nombre: "Raspberry Salida", sector: "Salida del horno", whepUrl: "https://cam.test/salida/whep" },
    ])
  })

  it("acepta un Record sectorId→nombre como mapa de sectores", () => {
    const nodes = cameraNodesFromDevices(
      [device({ dispositivoId: "n-1", sectorId: "sec-1", whepUrl: "https://cam.test/whep" })],
      { "sec-1": "Horno 1" },
    )

    expect(nodes).toEqual([
      { id: "n-1", nombre: "Nodo", sector: "Horno 1", whepUrl: "https://cam.test/whep" },
    ])
  })

  it("deja el sector vacío si no hay mapa o el dispositivo no tiene sector", () => {
    const nodes = cameraNodesFromDevices([
      device({ dispositivoId: "n-1", whepUrl: "https://cam.test/whep" }),
      device({ dispositivoId: "n-2", sectorId: "sec-9", whepUrl: "https://cam.test/otra/whep" }),
    ])

    expect(nodes).toEqual([
      { id: "n-1", nombre: "Nodo", sector: "", whepUrl: "https://cam.test/whep" },
      { id: "n-2", nombre: "Nodo", sector: "", whepUrl: "https://cam.test/otra/whep" },
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
      { id: "n-1", nombre: "Nodo", sector: "", whepUrl: "https://cam.test/whep" },
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
