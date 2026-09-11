import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const decodeSessionTokenMock = vi.hoisted(() => vi.fn())
const isSessionExpiredMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/lib/auth', () => ({
  decodeSessionToken: decodeSessionTokenMock,
  isSessionExpired: isSessionExpiredMock,
  ROLE_LEVEL: { Administrador: 3, Supervisor: 2, Operario: 1 },
}))

import proxy from '@/proxy'

describe('proxy de autorización', () => {
  beforeEach(() => {
    decodeSessionTokenMock.mockReset()
    isSessionExpiredMock.mockReturnValue(false)
  })

  function request(path: string, role?: 'Administrador' | 'Supervisor' | 'Operario') {
    const nextRequest = new NextRequest(`https://app.example${path}`)
    if (role) nextRequest.cookies.set('session_token', `token-${role}`)
    decodeSessionTokenMock.mockReturnValue(
      role
        ? { email: 'user@fermar.com', nombre: 'Usuario', rol: role }
        : null,
    )
    return nextRequest
  }

  it.each(['Administrador', 'Supervisor'])('permite %s en /supervision', (role) => {
    const response = proxy(request('/supervision?camera=main', role as 'Administrador' | 'Supervisor'))

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('X-User-Role')).toBe(role)
  })

  it('rechaza Operario en /supervision', () => {
    const response = proxy(request('/supervision', 'Operario'))

    expect(response.headers.get('location')).toBe('https://app.example/unauthorized')
  })

  it('preserva pathname y query al pedir login', () => {
    const response = proxy(request('/supervision?camera=main&turno=noche'))

    expect(response.headers.get('location')).toBe(
      'https://app.example/login?callbackUrl=%2Fsupervision%3Fcamera%3Dmain%26turno%3Dnoche',
    )
  })

  it('ya no protege el prefijo obsoleto /supervisor', () => {
    const response = proxy(request('/supervisor', 'Operario'))

    expect(response.headers.get('location')).toBeNull()
  })
})
