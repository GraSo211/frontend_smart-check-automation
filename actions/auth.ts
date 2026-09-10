'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateLoginForm } from '@/lib/auth-validation'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://backend-smart-check-automation-go.onrender.com'

const SESSION_COOKIE = 'session_token'
const SESSION_MAX_AGE = 8 * 60 * 60

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[]
}

type SessionCookieResult =
  | { ok: true }
  | { ok: false; message: string }

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as HeadersWithSetCookie
  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    const values = headersWithSetCookie.getSetCookie()
    if (values.length > 0) return values
  }

  const combinedHeader = headers.get('set-cookie')
  return combinedHeader
    ? combinedHeader.split(/,(?=\s*[^;,=\s]+=)/)
    : []
}

function normalizeSessionToken(value: string): string | null {
  const isQuoted = value.startsWith('"') || value.endsWith('"')
  if (!isQuoted) return value || null
  if (!value.startsWith('"') || !value.endsWith('"') || value.length <= 2) return null

  const unquoted = value.slice(1, -1)
  return unquoted && !/["\\\u0000-\u001f\u007f]/.test(unquoted) ? unquoted : null
}

function getSessionTokenFromHeaders(headers: Headers): string | null {
  for (const header of getSetCookieHeaders(headers)) {
    const firstPair = header.split(';', 1)[0]
    const separator = firstPair.indexOf('=')
    if (separator <= 0) continue

    const name = firstPair.slice(0, separator).trim()
    if (name !== SESSION_COOKIE) continue

    const value = normalizeSessionToken(firstPair.slice(separator + 1).trim())
    if (value) return value
  }

  return null
}

async function saveSessionCookie(headers: Headers): Promise<SessionCookieResult> {
  const token = getSessionTokenFromHeaders(headers)
  if (!token) {
    return {
      ok: false,
      message: 'El servidor no devolvió una cookie de sesión válida. Intentá nuevamente.',
    }
  }

  try {
    const cookieStore = await cookies()
    cookieStore.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })

    if (typeof cookieStore.get === 'function' && cookieStore.get(SESSION_COOKIE)?.value !== token) {
      return {
        ok: false,
        message: 'No se pudo guardar la sesión. Intentá nuevamente.',
      }
    }
  } catch {
    return {
      ok: false,
      message: 'No se pudo guardar la sesión. Intentá nuevamente.',
    }
  }

  return { ok: true }
}

/**
 * Server Action: Cierra la sesión del usuario.
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? ''
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      signal: controller.signal,
    })
  } catch {
    // El cierre local debe completarse aunque el backend falle.
  } finally {
    clearTimeout(timeout)
  }

  cookieStore.delete(SESSION_COOKIE)

  redirect('/login')
}

/**
 * Server Action: Envía el ID Token de Google al backend para autenticar.
 */
export async function loginWithGoogleAction(
  googleToken: string,
): Promise<{ ok: boolean; message?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleToken }),
      signal: controller.signal,
    })

    if (response.status === 401) {
      return {
        ok: false,
        message:
          'Tu cuenta corporativa no está registrada en el sistema o ha sido desactivada. Contactá a tu administrador.',
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        message: `Error del servidor (${response.status}). Intentá nuevamente.`,
      }
    }

    const sessionResult = await saveSessionCookie(response.headers)
    if (!sessionResult.ok) {
      return sessionResult
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      message:
        'No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.',
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Server Action: Procesa el inicio de sesión local mediante correo y contraseña.
 *
 * 1. Valida el formato de email y contraseña.
 * 2. Realiza la petición POST /api/v1/auth/login al backend en Go.
 * 3. El backend verifica las credenciales (bcrypt) y despacha la cookie de sesión JWT.
 */
export async function loginWithLocalAction(
  email: string,
  password: string,
): Promise<{ ok: boolean; message?: string; errors?: { email?: string; password?: string } }> {
  // Validación previa de formato
  const validation = validateLoginForm(email, password)
  if (!validation.isValid) {
    return {
      ok: false,
      errors: validation.errors,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
      signal: controller.signal,
    })

    if (response.status === 401) {
      return {
        ok: false,
        message: 'Correo electrónico o contraseña incorrectos. Verificá tus datos e intentá nuevamente.',
      }
    }

    if (response.status === 404) {
      return {
        ok: false,
        message: 'Usuario no registrado en el sistema. Contactá a tu administrador.',
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        message: `Error de autenticación (${response.status}). Intentá nuevamente.`,
      }
    }

    const sessionResult = await saveSessionCookie(response.headers)
    if (!sessionResult.ok) {
      return sessionResult
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      message: 'No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.',
    }
  } finally {
    clearTimeout(timeout)
  }
}
