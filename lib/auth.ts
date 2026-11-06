import { jwtVerify } from 'jose'

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
const JWT_ISSUER = 'smart-check-automation'
const JWT_ALGORITHM = 'HS256'
const ROLES: readonly UserRole[] = ['Administrador', 'Supervisor', 'Operario']

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET no está definida. Configurá la misma clave que usa el backend Go.',
    )
  }
  return new TextEncoder().encode(secret)
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Verifica firma, issuer y expiración del JWT y normaliza el payload al
 * contrato interno (`nombre`/`rol`). Devuelve null si el token es inválido.
 */
async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getJwtSecret()

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      requiredClaims: ['exp'],
    })

    const email = typeof payload.email === 'string' ? payload.email : ''
    const nombre =
      typeof payload.nombre === 'string'
        ? payload.nombre
        : typeof payload.name === 'string'
          ? payload.name
          : ''
    const rol = payload.rol ?? payload.role

    if (!email || !nombre || !isUserRole(rol)) return null

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
 * Lee y verifica la sesión desde las cookies del servidor (Server Components /
 * layouts). Lanza si falta `JWT_SECRET`; devuelve null si el token es inválido.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  return verifySessionToken(token)
}

/**
 * Verifica un token JWT raw (string).
 * Usada desde el proxy de Next.js, donde no se tiene acceso a `cookies()`.
 */
export async function decodeSessionToken(token: string): Promise<SessionPayload | null> {
  return verifySessionToken(token)
}
