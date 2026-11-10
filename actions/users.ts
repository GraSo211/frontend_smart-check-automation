'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getBackendUrl } from '@/lib/api-client'

const SESSION_COOKIE = 'session_token'
const REQUEST_TIMEOUT_MS = 8_000

export interface UserDTO {
  id: string
  email: string
  nombre: string
  rol: 'Administrador' | 'Supervisor' | 'Operario'
  activo: boolean
  createdAt: string
  updatedAt: string
}

async function getAuthHeaders() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return {
    'Content-Type': 'application/json',
    Cookie: `${SESSION_COOKIE}=${token || ''}`,
  }
}

async function backendFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${getBackendUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'El backend no respondió a tiempo.'
  }
  return 'No se pudo conectar con el servidor.'
}

/**
 * Server Action: Obtiene la lista completa de usuarios corporativos (Solo Admin)
 */
export async function getUsersAction(): Promise<{
  ok: boolean
  users?: UserDTO[]
  message?: string
}> {
  try {
    const headers = await getAuthHeaders()
    const response = await backendFetch('/api/v1/admin/usuarios', {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (response.status === 401) {
      return { ok: false, message: 'Sesión expirada o no autenticado.' }
    }
    if (!response.ok) {
      return { ok: false, message: `Error (${response.status}) al obtener usuarios` }
    }

    const data = await response.json()
    return { ok: true, users: data.data || [] }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

/**
 * Server Action: Crea un nuevo usuario corporativo (Solo Admin)
 */
export async function createUserAction(payload: {
  email: string
  nombre: string
  rol: string
  password?: string
}): Promise<{ ok: boolean; message?: string; user?: UserDTO }> {
  try {
    const headers = await getAuthHeaders()
    const response = await backendFetch('/api/v1/admin/usuarios', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (response.status === 401) {
      return { ok: false, message: 'Sesión expirada o no autenticado.' }
    }
    if (!response.ok) {
      return { ok: false, message: data.message || 'Error al crear usuario' }
    }

    revalidatePath('/usuarios')
    return { ok: true, user: data.data }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

/**
 * Server Action: Actualiza el rol o estado (activo/inactivo) de un usuario (Solo Admin)
 */
export async function updateUserAction(
  id: string,
  payload: { nombre?: string; rol?: string; activo?: boolean }
): Promise<{ ok: boolean; message?: string }> {
  try {
    const headers = await getAuthHeaders()
    const response = await backendFetch(`/api/v1/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (response.status === 401) {
      return { ok: false, message: 'Sesión expirada o no autenticado.' }
    }
    if (!response.ok) {
      return { ok: false, message: data.message || 'Error al actualizar usuario' }
    }

    revalidatePath('/usuarios')
    return { ok: true }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}
