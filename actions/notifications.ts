'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getBackendUrl } from '@/lib/api-client'
import {
  buildUpdateNotificationPreferencesBody,
  parseNotificationRecipient,
  parseNotificationSettingsData,
  type NotificationRecipient,
  type NotificationSettingsData,
  type UpdateNotificationPreferencesInput,
} from '@/lib/notification-settings'

const SESSION_COOKIE = 'session_token'
const DEFAULT_TIMEOUT_MS = 8_000
const TEST_TIMEOUT_MS = 15_000

async function getAuthHeaders() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return {
    'Content-Type': 'application/json',
    Cookie: `${SESSION_COOKIE}=${token || ''}`,
  }
}

async function backendFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
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
  if (error instanceof Error) {
    return error.message
  }
  return 'No se pudo conectar con el servidor.'
}

function standardErrorMessage(status: number, backendMessage?: string): string {
  if (backendMessage) return backendMessage
  if (status === 400) return 'Datos inválidos.'
  if (status === 401) return 'Sesión expirada o no autenticado.'
  if (status === 403) return 'No tenés permisos para esta acción.'
  if (status === 404) return 'Usuario no encontrado.'
  if (status === 409) return 'Conflicto al aplicar el cambio.'
  if (status === 502) return 'El proveedor de notificaciones no respondió.'
  return `Error (${status}) al procesar la solicitud.`
}

/**
 * Server Action: Obtiene el estado de canales y destinatarios de notificaciones.
 */
export async function getNotificationSettingsAction(): Promise<
  { ok: true; data: NotificationSettingsData } | { ok: false; message: string }
> {
  try {
    const headers = await getAuthHeaders()
    const response = await backendFetch(
      '/api/v1/admin/notificaciones',
      { method: 'GET', headers, cache: 'no-store' },
      DEFAULT_TIMEOUT_MS,
    )

    if (response.status === 401) {
      return { ok: false, message: 'Sesión expirada o no autenticado.' }
    }
    if (!response.ok) {
      return {
        ok: false,
        message: `Error (${response.status}) al obtener la configuración de notificaciones.`,
      }
    }

    const envelope = (await response.json()) as { data?: unknown }
    const data = parseNotificationSettingsData(envelope.data)
    return { ok: true, data }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

/**
 * Server Action: Actualiza las preferencias de notificación de un usuario.
 * Un string vacío para telegramChatId se envía como "" para borrar el chat ID.
 */
export async function updateNotificationPreferencesAction(
  userId: string,
  payload: UpdateNotificationPreferencesInput,
): Promise<{ ok: boolean; message?: string; recipient?: NotificationRecipient }> {
  try {
    const headers = await getAuthHeaders()
    const response = await backendFetch(
      `/api/v1/admin/notificaciones/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(buildUpdateNotificationPreferencesBody(payload)),
      },
      DEFAULT_TIMEOUT_MS,
    )

    if (response.status === 401) {
      return { ok: false, message: 'Sesión expirada o no autenticado.' }
    }

    const envelope = (await response.json()) as { success: boolean; message?: string; data?: unknown }

    if (!response.ok) {
      return {
        ok: false,
        message: standardErrorMessage(response.status, envelope.message),
      }
    }

    const recipient = parseNotificationRecipient(envelope.data)
    revalidatePath('/configuracion/notificaciones')
    return { ok: true, recipient }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

/**
 * Server Action: Envía una notificación de prueba a un usuario por el canal indicado.
 */
export async function sendTestNotificationAction(
  userId: string,
  channel: 'EMAIL' | 'TELEGRAM',
): Promise<{ ok: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders()
    const response = await backendFetch(
      '/api/v1/admin/notificaciones/test',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ canal: channel, usuario_id: userId }),
      },
      TEST_TIMEOUT_MS,
    )

    if (response.status === 401) {
      return { ok: false, message: 'Sesión expirada o no autenticado.' }
    }

    const envelope = (await response.json()) as { success: boolean; message?: string }

    if (!response.ok) {
      return {
        ok: false,
        message: standardErrorMessage(response.status, envelope.message),
      }
    }

    return { ok: true, message: envelope.message || 'Mensaje de prueba enviado.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}
