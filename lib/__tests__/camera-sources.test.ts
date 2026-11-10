import { describe, expect, it } from "vitest"
import { cameraNodesFromDevices, deviceStreamPath, deviceWhepUrl, streamSlug } from "@/lib/camera-sources"
import type { Device } from "@/lib/devices-data"

function device(overrides: Partial<Device> & { dispositivoId: string }): Device {
  return {
    nombre: "Dispositivo",
    estado: "offline",
    lastSeen: "",
    ...overrides,
  }
}

describe("streamSlug", () => {
  it("normaliza acentos, mayúsculas y caracteres especiales", () => {
    expect(streamSlug("RB-1 Entrada")).toBe("rb-1-entrada")
    expect(streamSlug("Cámara Salida!!!")).toBe("camara-salida")
    expect(streamSlug("  Horno #2  ")).toBe("horno-2")
  })

  it("usa dispositivo como fallback cuando no queda nada", () => {
    expect(streamSlug("")).toBe("dispositivo")
    expect(streamSlug("!!!")).toBe("dispositivo")
  })
})

describe("deviceStreamPath", () => {
  it("arma el path con slug y sufijo de tipo", () => {
    expect(deviceStreamPath("RB-1", "ENTRADA_HORNO")).toBe("rb-1-entrada")
    expect(deviceStreamPath("RB-1", "SALIDA_HORNO")).toBe("rb-1-salida")
  })

  it("devuelve null si falta el tipo", () => {
    expect(deviceStreamPath("RB-1", undefined)).toBeNull()
  })
})

describe("deviceWhepUrl", () => {
  it("arma la URL WHEP completa", () => {
    expect(deviceWhepUrl({ nombre: "RB-1", type: "ENTRADA_HORNO" }, "https://cam.test")).toBe(
      "https://cam.test/rb-1-entrada/whep",
    )
    expect(deviceWhepUrl({ nombre: "RB-1", type: "SALIDA_HORNO" }, "https://cam.test/")).toBe(
      "https://cam.test/rb-1-salida/whep",
    )
  })

  it("devuelve null si falta la base o el tipo", () => {
    expect(deviceWhepUrl({ nombre: "RB-1", type: "ENTRADA_HORNO" }, "")).toBeNull()
    expect(deviceWhepUrl({ nombre: "RB-1", type: "ENTRADA_HORNO" }, "   ")).toBeNull()
    expect(deviceWhepUrl({ nombre: "RB-1", type: "ENTRADA_HORNO" }, "mediamtx.local")).toBeNull()
    expect(deviceWhepUrl({ nombre: "RB-1", type: "ENTRADA_HORNO" }, "rtsp://cam.test")).toBeNull()
    expect(deviceWhepUrl({ nombre: "RB-1", type: undefined }, "https://cam.test")).toBeNull()
  })
})

describe("cameraNodesFromDevices", () => {
  it("mapea sólo los dispositivos con URL derivada y preserva el orden", () => {
    const devices: Device[] = [
      device({ dispositivoId: "n-1", nombre: "Raspberry 1", sectorId: "sec-1", type: "ENTRADA_HORNO" }),
      device({ dispositivoId: "n-2", nombre: "Sin tipo", sectorId: "sec-2" }),
      device({ dispositivoId: "n-3", nombre: "Raspberry 2", sectorId: "sec-3", type: "SALIDA_HORNO" }),
    ]
    const sectorNames = new Map([
      ["sec-1", "Entrada del horno"],
      ["sec-3", "Salida del horno"],
    ])

    expect(cameraNodesFromDevices(devices, sectorNames, "https://cam.test")).toEqual([
      { id: "n-1", nombre: "Raspberry 1", sector: "Entrada del horno", whepUrl: "https://cam.test/raspberry-1-entrada/whep" },
      { id: "n-3", nombre: "Raspberry 2", sector: "Salida del horno", whepUrl: "https://cam.test/raspberry-2-salida/whep" },
    ])
  })

  it("acepta un Record sectorId→nombre como mapa de sectores", () => {
    const nodes = cameraNodesFromDevices(
      [device({ dispositivoId: "n-1", nombre: "RB-1", sectorId: "sec-1", type: "ENTRADA_HORNO" })],
      { "sec-1": "Horno 1" },
      "https://cam.test",
    )

    expect(nodes).toEqual([
      { id: "n-1", nombre: "RB-1", sector: "Horno 1", whepUrl: "https://cam.test/rb-1-entrada/whep" },
    ])
  })

  it("deja el sector vacío si no hay mapa o el dispositivo no tiene sector", () => {
    const nodes = cameraNodesFromDevices(
      [
        device({ dispositivoId: "n-1", nombre: "RB-1", type: "ENTRADA_HORNO" }),
        device({ dispositivoId: "n-2", nombre: "RB-2", sectorId: "sec-9", type: "SALIDA_HORNO" }),
      ],
      undefined,
      "https://cam.test",
    )

    expect(nodes).toEqual([
      { id: "n-1", nombre: "RB-1", sector: "", whepUrl: "https://cam.test/rb-1-entrada/whep" },
      { id: "n-2", nombre: "RB-2", sector: "", whepUrl: "https://cam.test/rb-2-salida/whep" },
    ])
  })

  it("devuelve [] para null, lista vacía o dispositivos sin cámara derivable", () => {
    expect(cameraNodesFromDevices(null)).toEqual([])
    expect(cameraNodesFromDevices([])).toEqual([])
    expect(cameraNodesFromDevices([device({ dispositivoId: "n-1" })])).toEqual([])
  })

  it("respeta la base pasada por parámetro y sin base no deriva", () => {
    expect(cameraNodesFromDevices(
      [device({ dispositivoId: "n-1", nombre: "RB-1", type: "ENTRADA_HORNO" })],
      undefined,
      "",
    )).toEqual([])
  })
})
