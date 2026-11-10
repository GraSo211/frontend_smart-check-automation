import { beforeAll, describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import {
  ROLE_LEVEL,
  hasMinRole,
  decodeSessionToken,
} from '@/lib/auth'

const TEST_SECRET = 'test-jwt-secret-with-at-least-32-characters'
const secretBytes = new TextEncoder().encode(TEST_SECRET)

function sign(
  claims: Record<string, unknown>,
  options: { secret?: Uint8Array; issuer?: string; expiresIn?: string | number | null } = {},
) {
  let token = new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(options.issuer ?? 'smart-check-automation')
    .setIssuedAt()

  if (options.expiresIn !== null) {
    token = token.setExpirationTime(options.expiresIn ?? '1h')
  }

  return token.sign(options.secret ?? secretBytes)
}

describe('Auth Utilities & Role Hierarchy', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET
  })

  describe('ROLE_LEVEL & hasMinRole', () => {
    it('assigns correct level hierarchy to roles', () => {
      expect(ROLE_LEVEL.Administrador).toBeGreaterThan(ROLE_LEVEL.Supervisor)
      expect(ROLE_LEVEL.Supervisor).toBeGreaterThan(ROLE_LEVEL.Operario)
    })

    it('returns true when user role meets or exceeds required minimum role', () => {
      expect(hasMinRole('Administrador', 'Supervisor')).toBe(true)
      expect(hasMinRole('Supervisor', 'Supervisor')).toBe(true)
      expect(hasMinRole('Operario', 'Operario')).toBe(true)
    })

    it('returns false when user role is below required minimum role', () => {
      expect(hasMinRole('Operario', 'Supervisor')).toBe(false)
      expect(hasMinRole('Supervisor', 'Administrador')).toBe(false)
      expect(hasMinRole('Operario', 'Administrador')).toBe(false)
    })
  })

  describe('decodeSessionToken', () => {
    it('returns null for empty or invalid token string', async () => {
      expect(await decodeSessionToken('')).toBeNull()
      expect(await decodeSessionToken('invalid-token')).toBeNull()
    })

    it('accepts a valid HS256 token and normalizes name/role', async () => {
      const token = await sign({
        email: 'user@fermar.com',
        name: 'Juan Perez',
        role: 'Supervisor',
      })

      expect(await decodeSessionToken(token)).toMatchObject({
        email: 'user@fermar.com',
        nombre: 'Juan Perez',
        rol: 'Supervisor',
      })
    })

    it('rejects a token signed with another secret', async () => {
      const token = await sign(
        { email: 'user@fermar.com', name: 'Juan Perez', role: 'Administrador' },
        { secret: new TextEncoder().encode('another-secret-with-32-characters!!') },
      )

      expect(await decodeSessionToken(token)).toBeNull()
    })

    it('rejects an expired token', async () => {
      const token = await sign(
        { email: 'user@fermar.com', name: 'Juan Perez', role: 'Supervisor' },
        { expiresIn: '-1h' },
      )

      expect(await decodeSessionToken(token)).toBeNull()
    })

    it('rejects a token without exp', async () => {
      const token = await sign(
        { email: 'user@fermar.com', name: 'Juan Perez', role: 'Supervisor' },
        { expiresIn: null },
      )

      expect(await decodeSessionToken(token)).toBeNull()
    })

    it('rejects a token from another issuer', async () => {
      const token = await sign(
        { email: 'user@fermar.com', name: 'Juan Perez', role: 'Supervisor' },
        { issuer: 'another-service' },
      )

      expect(await decodeSessionToken(token)).toBeNull()
    })

    it('rejects an unknown role', async () => {
      const token = await sign({
        email: 'user@fermar.com',
        name: 'Juan Perez',
        role: 'Root',
      })

      expect(await decodeSessionToken(token)).toBeNull()
    })
  })
})
