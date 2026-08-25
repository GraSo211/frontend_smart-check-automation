/**
 * Cliente HTTP centralizado para el frontend de Smart-Check Automation.
 *
 * - Siempre incluye `credentials: 'include'` para enviar la cookie `session_token`.
 * - Tipado con el contrato JSON estandarizado del backend Go.
 * - Lanza ApiError con `status: 401` cuando la sesión expira o es inválida.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://backend-smart-check-automation-go.onrender.com'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Contrato JSON estándar del backend Go */
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
  errors: string[] | null
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

// ─── Fetch central ───────────────────────────────────────────────────────────

/**
 * Wrapper de fetch que incluye credenciales y gestiona el contrato de respuesta.
 * Lanza `ApiError` ante respuestas no-ok del servidor.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${path}`

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // ¡CRÍTICO: envía la cookie session_token!
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      message: response.statusText,
    }))
    throw new ApiError(
      response.status,
      errorBody?.message ?? `Error ${response.status}`,
    )
  }

  const result: ApiResponse<T> = await response.json()

  if (!result.success) {
    throw new ApiError(200, result.message ?? 'Error desconocido del servidor')
  }

  return result
}

/**
 * Helper para verificar si un error es un ApiError de sesión expirada (401).
 */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
