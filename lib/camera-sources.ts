import type { Device } from "@/lib/devices-data"

// Fuentes de video para la supervisión en vivo.
//
// La URL WHEP es un dato del dispositivo: cada nodo (Raspberry) publica a lo
// sumo una cámara. La lista de fuentes se deriva de los dispositivos que
// tienen `whepUrl` configurado, sin variables de entorno de cámaras.

export type CameraNode = {
  id: string
  nombre: string
  ubicacion: string
  whepUrl: string
}

/**
 * Deriva las fuentes de video a partir de los dispositivos. Sólo los
 * dispositivos con `whepUrl` no vacío aportan una fuente y se preserva el
 * orden de entrada. Una lista nula, vacía o sin cámaras devuelve `[]`.
 */
export function cameraNodesFromDevices(devices: Device[] | null): CameraNode[] {
  if (!devices || devices.length === 0) return []
  return devices
    .filter(
      (device): device is Device & { whepUrl: string } =>
        typeof device.whepUrl === "string" && device.whepUrl.trim() !== "",
    )
    .map((device) => ({
      id: device.dispositivoId,
      nombre: device.nombre,
      ubicacion: device.ubicacion,
      whepUrl: device.whepUrl.trim(),
    }))
}

/**
 * Validación suave para formularios: acepta `http(s)://` y un path que termine
 * en `/whep`. El campo es opcional, por eso una cadena vacía se considera
 * válida y no debe bloquear el envío.
 */
export function isWhepUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return false
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false
  return url.pathname.endsWith("/whep")
}
