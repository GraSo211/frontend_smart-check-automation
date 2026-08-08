'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://backend-smart-check-automation-go.onrender.com'

const SESSION_COOKIE = 'session_token'

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

/**
 * Server Action: Obteine la lista completa de usuarios corporativos (Solo Admin)
 */
export async function getUsersAction(): Promise<{
  ok: boolean
  users?: UserDTO[]
  message?: string
}> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_URL}/api/v1/admin/usuarios`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      return { ok: false, message: `Error (${response.status}) al obtener usuarios` }
    }

    const data = await response.json()
    return { ok: true, users: data.data || [] }
  } catch {
    return { ok: false, message: 'No se pudo conectar con el servidor.' }
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
    const response = await fetch(`${API_URL}/api/v1/admin/usuarios`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return { ok: false, message: data.message || 'Error al crear usuario' }
    }

    revalidatePath('/usuarios')
    return { ok: true, user: data.data }
  } catch {
    return { ok: false, message: 'Error de conexión con el servidor.' }
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
    const response = await fetch(`${API_URL}/api/v1/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return { ok: false, message: data.message || 'Error al actualizar usuario' }
    }

    revalidatePath('/usuarios')
    return { ok: true }
  } catch {
    return { ok: false, message: 'Error de conexión con el servidor.' }
  }
}
