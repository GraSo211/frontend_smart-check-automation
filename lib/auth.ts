import { decodeJwt } from 'jose'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type UserRole = 'Administrador' | 'Supervisor' | 'Operario'

export interface SessionPayload {
  email: string
  nombre: string
  rol: UserRole
  exp?: number
  iat?: number
}

// ─── Jerarquía de roles ──────────────────────────────────────────────────────

/** Número mayor = más permisos */
export const ROLE_LEVEL: Record<UserRole, number> = {
  Administrador: 3,
  Supervisor: 2,
  Operario: 1,
}

/** Devuelve true si el rol tiene al menos el nivel mínimo requerido */
export function hasMinRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]
}

// ─── Helpers de sesión ───────────────────────────────────────────────────────

const SESSION_COOKIE = 'session_token'

/**
 * Lee y decodifica la sesión desde las cookies del servidor (Server Components / layouts).
 * NO verifica la firma — el backend de Go rechaza tokens falsos en cada request.
 * Retorna null si no hay cookie o el payload es inválido.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null

    const payload = decodeJwt(token)

    const email = (payload.email as string) || ''
    const nombre = (payload.nombre as string) || (payload.name as string) || ''
    const rol = (payload.rol as UserRole) || (payload.role as UserRole) || ''

    if (!email || !nombre || !rol) return null

    return {
      email,
      nombre,
      rol,
      exp: payload.exp,
      iat: payload.iat,
    }
  } catch {
    return null
  }
}

/**
 * Decodifica un token JWT raw (string).
 * Usada desde el middleware de Edge donde no se tiene acceso a `cookies()`.
 */
export function decodeSessionToken(token: string): SessionPayload | null {
  try {
    const payload = decodeJwt(token)

    const email = (payload.email as string) || ''
    const nombre = (payload.nombre as string) || (payload.name as string) || ''
    const rol = (payload.rol as UserRole) || (payload.role as UserRole) || ''

    if (!email || !nombre || !rol) return null

    return {
      email,
      nombre,
      rol,
      exp: payload.exp,
      iat: payload.iat,
    }
  } catch {
    return null
  }
}

/**
 * Verifica si la sesión está expirada comparando `exp` con la hora actual.
 */
export function isSessionExpired(session: SessionPayload): boolean {
  if (!session.exp) return false
  return Date.now() / 1000 > session.exp
}
