/**
 * Cliente HTTP centralizado para el frontend de SmartCheck Automation.
 *
 * Expone `ApiError`, el error tipado que usan las server actions para propagar
 * la sesión expirada (401) y otros fallos del backend Go, y la resolución
 * compartida de la URL base del backend.
 */

/**
 * URL base del backend Go. Requiere `NEXT_PUBLIC_API_URL` para evitar que un
 * deploy mal configurado caiga silenciosamente contra otro entorno.
 */
export function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '')
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_API_URL no está definida. Configurala en .env.local o en el entorno de despliegue.',
    )
  }
  return url
}

/**
 * Variante no-throwing para helpers de mutación que traducen una configuración
 * faltante a `{ ok: false }` en lugar de lanzar.
 */
export function getBackendUrlOrNull(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '')
  return url || null
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
