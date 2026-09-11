import { describe, expect, it } from 'vitest'
import { getSafeInternalRedirect } from '@/lib/auth-redirect'

describe('getSafeInternalRedirect', () => {
  it.each([
    '/',
    '/dashboard',
    '/lotes?page=2#historial',
    '/supervision?turno=noche',
  ])('permite destinos internos %s', (destination) => {
    expect(getSafeInternalRedirect(destination)).toBe(destination)
  })

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    '/%2F%2Fevil.example/path',
    '/%252F%252Fevil.example/path',
    '/\u0000danger',
    '/%0d%0aSet-Cookie:%20evil',
    'javascript:alert(1)',
    '/login?callbackUrl=/dashboard',
    '/%6Cogin',
    '/unauthorized',
    '/safe%3f/../login',
    '/safe%23/../unauthorized',
    '/safe%3f/../login?callbackUrl=%2Flotes',
    '/lotes/../login',
    '/lotes/%2e%2e/unauthorized',
  ])('reemplaza un destino inseguro %s por /', (destination) => {
    expect(getSafeInternalRedirect(destination)).toBe('/')
  })

  it('acepta el primer valor cuando el parámetro llega repetido', () => {
    expect(getSafeInternalRedirect(['/lotes?page=2', 'https://evil.example'])).toBe('/lotes?page=2')
  })

  it.each([undefined, null, '', 42, {}])('usa / si el destino no es texto: %s', (destination) => {
    expect(getSafeInternalRedirect(destination)).toBe('/')
  })
})
