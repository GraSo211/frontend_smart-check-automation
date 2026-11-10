import type { Device } from "@/lib/devices-data"

// Fuentes de video para la supervisión en vivo.
//
// La URL WHEP ya no es un campo editable del dispositivo: se deriva en el
// front a partir del nombre y el tipo funcional. El backend puede seguir
// enviando `whepUrl`, pero el front lo ignora y usa la URL derivada como
// fuente de verdad visual.

export type CameraNode = {
  id: string
  nombre: string
  sector: string
  whepUrl: string
}

/**
 * Convierte un nombre arbitrario en un slug de segmento de URL estable:
 * - normaliza Unicode (NFKD, igual que la Raspberry) y quita marcas combinantes
 * - minúsculas
 * - reemplaza cualquier secuencia no alfanumérica por un guión
 * - colapsa y recorta guiones sobrantes
 * Si el resultado queda vacío, devuelve "dispositivo".
 */
export function streamSlug(nombre: string): string {
  const normalized = nombre
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "dispositivo"
}

const TYPE_SUFFIX: Record<NonNullable<Device["type"]>, string> = {
  ENTRADA_HORNO: "entrada",
  SALIDA_HORNO: "salida",
}

/**
 * Devuelve el path del stream para un dispositivo: `<slug(nombre)>-<entrada|salida>`.
 * Si no hay tipo no se puede derivar el path (cada segmento requiere el rol).
 */
export function deviceStreamPath(
  nombre: string,
  type: Device["type"],
): string | null {
  if (!type) return null
  return `${streamSlug(nombre)}-${TYPE_SUFFIX[type]}`
}

/**
 * Construye la URL WHEP pública de un dispositivo a partir de su nombre, tipo
 * y la base pública de MediaMTX. Si falta la base o el tipo no hay URL.
 */
export function deviceWhepUrl(
  device: Pick<Device, "nombre" | "type">,
  baseUrl = process.env.NEXT_PUBLIC_MEDIAMTX_URL,
): string | null {
  const base = baseUrl?.trim().replace(/\/+$/, "")
  if (!base || !/^https?:\/\//i.test(base)) return null
  const path = deviceStreamPath(device.nombre, device.type)
  if (!path) return null
  return `${base}/${path}/whep`
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
 * dispositivos cuya URL WHEP pueda derivarse (tienen tipo y se puede construir
 * la URL) aportan una fuente y se preserva el orden de entrada. Una lista
 * nula, vacía o sin cámaras devuelve `[]`.
 *
 * `sectorNamesById` es opcional: permite poblar `CameraNode.sector` con el
 * nombre del sector a partir del `sectorId` del dispositivo (por ejemplo desde
 * `getSectores()`). Sin él, `sector` queda vacío.
 *
 * `baseUrl` es opcional y permite tests; por defecto usa
 * `process.env.NEXT_PUBLIC_MEDIAMTX_URL`.
 */
export function cameraNodesFromDevices(
  devices: Device[] | null,
  sectorNamesById?: ReadonlyMap<string, string> | Record<string, string>,
  baseUrl?: string,
): CameraNode[] {
  if (!devices || devices.length === 0) return []
  return devices
    .map((device) => {
      const whepUrl = deviceWhepUrl(device, baseUrl)
      if (!whepUrl) return null
      return {
        id: device.dispositivoId,
        nombre: device.nombre,
        sector: sectorNameFor(device, sectorNamesById),
        whepUrl,
      }
    })
    .filter((node): node is CameraNode => node !== null)
}
