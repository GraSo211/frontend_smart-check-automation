'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateLoginForm } from '@/lib/auth-validation'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://backend-smart-check-automation-go.onrender.com'

const SESSION_COOKIE = 'session_token'

/**
 * Server Action: Cierra la sesión del usuario.
 */
export async function logoutAction(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Continuar aunque el backend falle — igual borramos la cookie local
  }

  // Borrar la cookie localmente como respaldo
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)

  redirect('/login')
}

/**
 * Server Action: Envía el ID Token de Google al backend para autenticar.
 */
export async function loginWithGoogleAction(
  googleToken: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleToken }),
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

    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      const tokenMatch = setCookieHeader.match(/session_token=([^;]+)/)
      if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1]
        const cookieStore = await cookies()
        cookieStore.set({
          name: SESSION_COOKIE,
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 8 * 60 * 60,
        })
      }
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      message:
        'No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.',
    }
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

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
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

    // El backend Go envía el JWT en una cookie 'session_token'
    // Como estamos en un Server Action (Node.js), necesitamos leer ese header
    // y aplicarlo manualmente a las cookies del navegador del usuario.
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      // Formato típico: session_token=ey...; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800
      const tokenMatch = setCookieHeader.match(/session_token=([^;]+)/)
      if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1]
        const cookieStore = await cookies()
        cookieStore.set({
          name: SESSION_COOKIE,
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 8 * 60 * 60, // 8 horas, igual que el backend
        })
      }
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      message: 'No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.',
    }
  }
}
