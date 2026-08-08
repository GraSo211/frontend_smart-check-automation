import { describe, it, expect } from 'vitest'
import { validateEmail, validatePassword, validateLoginForm } from '@/lib/auth-validation'

describe('Local Authentication Client Validation (SCA-39)', () => {
  describe('validateEmail', () => {
    it('returns error when email is empty or whitespace', () => {
      expect(validateEmail('')).toEqual({
        isValid: false,
        error: 'Ingresá tu correo electrónico.',
      })
      expect(validateEmail('   ')).toEqual({
        isValid: false,
        error: 'Ingresá tu correo electrónico.',
      })
    })

    it('returns error when email format is invalid', () => {
      expect(validateEmail('usuario')).toEqual({
        isValid: false,
        error: 'Ingresá un correo electrónico válido.',
      })
      expect(validateEmail('usuario@')).toEqual({
        isValid: false,
        error: 'Ingresá un correo electrónico válido.',
      })
      expect(validateEmail('usuario@fermar')).toEqual({
        isValid: false,
        error: 'Ingresá un correo electrónico válido.',
      })
    })

    it('returns isValid true for valid corporate email formats', () => {
      expect(validateEmail('supervisor@fermar.com')).toEqual({ isValid: true })
      expect(validateEmail('operario.planta@fermar.com.ar')).toEqual({ isValid: true })
    })
  })

  describe('validatePassword', () => {
    it('returns error when password is empty', () => {
      expect(validatePassword('')).toEqual({
        isValid: false,
        error: 'Ingresá tu contraseña.',
      })
    })

    it('returns error when password is shorter than 6 characters', () => {
      expect(validatePassword('12345')).toEqual({
        isValid: false,
        error: 'La contraseña debe tener al menos 6 caracteres.',
      })
    })

    it('returns isValid true for passwords with 6 or more characters', () => {
      expect(validatePassword('123456')).toEqual({ isValid: true })
      expect(validatePassword('PasswordSegura2026!')).toEqual({ isValid: true })
    })
  })

  describe('validateLoginForm', () => {
    it('returns invalid state and field errors when inputs are invalid', () => {
      const result = validateLoginForm('email-invalido', '123')
      expect(result.isValid).toBe(false)
      expect(result.errors.email).toBe('Ingresá un correo electrónico válido.')
      expect(result.errors.password).toBe('La contraseña debe tener al menos 6 caracteres.')
    })

    it('returns isValid true and empty errors object when inputs are correct', () => {
      const result = validateLoginForm('supervisor@fermar.com', 'ClaveSegura123')
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual({})
    })
  })
})
