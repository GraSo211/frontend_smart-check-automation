import { describe, it, expect } from 'vitest'
import {
  ROLE_LEVEL,
  hasMinRole,
  decodeSessionToken,
  isSessionExpired,
  type SessionPayload,
} from '@/lib/auth'

describe('Auth Utilities & Role Hierarchy', () => {
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
    it('returns null for empty or invalid token string', () => {
      expect(decodeSessionToken('')).toBeNull()
      expect(decodeSessionToken('invalid-token')).toBeNull()
    })
  })

  describe('isSessionExpired', () => {
    it('returns false if session has no expiration field (exp)', () => {
      const session: SessionPayload = {
        email: 'user@fermar.com',
        nombre: 'Juan Perez',
        rol: 'Supervisor',
      }
      expect(isSessionExpired(session)).toBe(false)
    })

    it('returns true if exp is in the past', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const session: SessionPayload = {
        email: 'user@fermar.com',
        nombre: 'Juan Perez',
        rol: 'Supervisor',
        exp: pastTime,
      }
      expect(isSessionExpired(session)).toBe(true)
    })

    it('returns false if exp is in the future', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600 // 1 hour ahead
      const session: SessionPayload = {
        email: 'user@fermar.com',
        nombre: 'Juan Perez',
        rol: 'Supervisor',
        exp: futureTime,
      }
      expect(isSessionExpired(session)).toBe(false)
    })
  })
})
