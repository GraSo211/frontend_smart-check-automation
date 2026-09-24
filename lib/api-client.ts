/**
 * Cliente HTTP centralizado para el frontend de Smart-Check Automation.
 *
 * Expone `ApiError`, el error tipado que usan las server actions para propagar
 * la sesión expirada (401) y otros fallos del backend Go, y `getBackendUrl()`,
 * la resolución compartida de la URL base del backend.
 */

const FALLBACK_BACKEND_URL =
  'https://backend-smart-check-automation-go.onrender.com'

/**
 * URL base del backend Go. Usa `NEXT_PUBLIC_API_URL` y cae al backend de Render
 * cuando la variable no está definida.
 */
export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || FALLBACK_BACKEND_URL
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
