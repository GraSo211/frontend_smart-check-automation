import type { Device } from "@/lib/devices-data"

// Fuentes de video para la supervisión en vivo.
//
// La URL WHEP es un dato del dispositivo: cada nodo (Raspberry) publica a lo
// sumo una cámara. La lista de fuentes se deriva de los dispositivos que
// tienen `whepUrl` configurado, sin variables de entorno de cámaras.

export type CameraNode = {
  id: string
  nombre: string
  sector: string
  whepUrl: string
}

/**
 * Resuelve el nombre de sector del dispositivo a partir de un mapa
 * `sectorId → nombre`. El dispositivo sólo expone `sectorId`, por lo que sin
 * mapa no hay nombre disponible y se usa `""`.
 */
function sectorNameFor(
  device: Device,
  sectorNamesById?: ReadonlyMap<string, string> | Record<string, string>,
): string {
  if (!device.sectorId || !sectorNamesById) return ""
  const maybeMap = sectorNamesById as { get?: (key: string) => string | undefined }
  const name = typeof maybeMap.get === "function"
    ? (sectorNamesById as ReadonlyMap<string, string>).get(device.sectorId)
    : (sectorNamesById as Record<string, string>)[device.sectorId]
  return typeof name === "string" ? name : ""
}

/**
 * Deriva las fuentes de video a partir de los dispositivos. Sólo los
 * dispositivos con `whepUrl` no vacío aportan una fuente y se preserva el
 * orden de entrada. Una lista nula, vacía o sin cámaras devuelve `[]`.
 *
 * `sectorNamesById` es opcional: permite poblar `CameraNode.sector` con el
 * nombre del sector a partir del `sectorId` del dispositivo (por ejemplo desde
 * `getSectores()`). Sin él, `sector` queda vacío.
 */
export function cameraNodesFromDevices(
  devices: Device[] | null,
  sectorNamesById?: ReadonlyMap<string, string> | Record<string, string>,
): CameraNode[] {
  if (!devices || devices.length === 0) return []
  return devices
    .filter(
      (device): device is Device & { whepUrl: string } =>
        typeof device.whepUrl === "string" && device.whepUrl.trim() !== "",
    )
    .map((device) => ({
      id: device.dispositivoId,
      nombre: device.nombre,
      sector: sectorNameFor(device, sectorNamesById),
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
