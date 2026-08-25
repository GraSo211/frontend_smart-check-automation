import { NextRequest, NextResponse } from 'next/server'
import { decodeSessionToken, isSessionExpired, ROLE_LEVEL, type UserRole } from '@/lib/auth'

// ─── Configuración de rutas ───────────────────────────────────────────────────

/** Rutas que NO requieren autenticación */
const PUBLIC_PATHS = ['/login', '/unauthorized']

/** Mínimo rol requerido por prefijo de ruta */
const PROTECTED_ROUTES: Array<{ prefix: string; minRole: UserRole }> = [
  { prefix: '/usuarios', minRole: 'Administrador' },
  { prefix: '/supervisor', minRole: 'Supervisor' },
]

const SESSION_COOKIE = 'session_token'

// ─── Proxy (reemplaza al middleware en Next.js 16) ───────────────────────────

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorar rutas de archivos estáticos y API interna de Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Rutas públicas: permitir siempre
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Leer y decodificar el token de sesión
  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    return redirectToLogin(request)
  }

  const session = decodeSessionToken(token)

  if (!session) {
    return redirectToLogin(request)
  }

  if (isSessionExpired(session)) {
    return redirectToLogin(request)
  }

  // Control de acceso basado en rol
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      const userLevel = ROLE_LEVEL[session.rol]
      const requiredLevel = ROLE_LEVEL[route.minRole]

      if (userLevel < requiredLevel) {
        const url = request.nextUrl.clone()
        url.pathname = '/unauthorized'
        return NextResponse.redirect(url)
      }
    }
  }

  // Pasar rol como header interno para que Server Components lo lean si necesitan
  const response = NextResponse.next()
  response.headers.set('X-User-Role', session.rol)
  response.headers.set('X-User-Email', session.email)
  response.headers.set('X-User-Nombre', session.nombre)

  return response
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  // Guardar la URL original para redirigir de vuelta post-login (opcional)
  url.searchParams.set('callbackUrl', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

// ─── Configuración del matcher ────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico, imágenes públicas
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
