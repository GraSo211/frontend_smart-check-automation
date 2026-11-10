import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const decodeSessionTokenMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  decodeSessionToken: decodeSessionTokenMock,
  ROLE_LEVEL: { Administrador: 3, Supervisor: 2, Operario: 1 },
}))

import proxy from '@/proxy'

describe('proxy de autorización', () => {
  beforeEach(() => {
    decodeSessionTokenMock.mockReset()
  })

  function request(path: string, role?: 'Administrador' | 'Supervisor' | 'Operario') {
    const nextRequest = new NextRequest(`https://app.example${path}`)
    if (role) nextRequest.cookies.set('session_token', `token-${role}`)
    decodeSessionTokenMock.mockResolvedValue(
      role
        ? { email: 'user@fermar.com', nombre: 'Usuario', rol: role }
        : null,
    )
    return nextRequest
  }

  it.each(['Administrador', 'Supervisor'])('permite %s en /supervision', async (role) => {
    const response = await proxy(
      request('/supervision?camera=main', role as 'Administrador' | 'Supervisor'),
    )

    expect(response.headers.get('location')).toBeNull()
  })

  it('rechaza Operario en /supervision', async () => {
    const response = await proxy(request('/supervision', 'Operario'))

    expect(response.headers.get('location')).toBe('https://app.example/unauthorized')
  })

  it.each(['Administrador', 'Supervisor'])('permite %s en /sectores', async (role) => {
    const response = await proxy(request('/sectores', role as 'Administrador' | 'Supervisor'))

    expect(response.headers.get('location')).toBeNull()
  })

  it('rechaza Operario en /sectores', async () => {
    const response = await proxy(request('/sectores', 'Operario'))

    expect(response.headers.get('location')).toBe('https://app.example/unauthorized')
  })

  it('preserva pathname y query al pedir login', async () => {
    const response = await proxy(request('/supervision?camera=main&turno=noche'))

    expect(response.headers.get('location')).toBe(
      'https://app.example/login?callbackUrl=%2Fsupervision%3Fcamera%3Dmain%26turno%3Dnoche',
    )
  })

  it('ya no protege el prefijo obsoleto /supervisor', async () => {
    const response = await proxy(request('/supervisor', 'Operario'))

    expect(response.headers.get('location')).toBeNull()
  })
})
