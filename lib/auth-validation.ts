/**
 * Validador de formato de correo electrónico corporativo
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const trimmed = email.trim()
  if (!trimmed) {
    return { isValid: false, error: 'Ingresá tu correo electrónico.' }
  }

  // Regex estándar de formato de correo electrónico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Ingresá un correo electrónico válido.' }
  }

  return { isValid: true }
}

/**
 * Validador de contraseña
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Ingresá tu contraseña.' }
  }

  if (password.length < 6) {
    return { isValid: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  return { isValid: true }
}

export interface LoginFormErrors {
  email?: string
  password?: string
}

/**
 * Validación completa del formulario de login local
 */
export function validateLoginForm(
  email: string,
  password: string,
): { isValid: boolean; errors: LoginFormErrors } {
  const emailResult = validateEmail(email)
  const passwordResult = validatePassword(password)

  const errors: LoginFormErrors = {}
  if (!emailResult.isValid) errors.email = emailResult.error
  if (!passwordResult.isValid) errors.password = passwordResult.error

  return {
    isValid: emailResult.isValid && passwordResult.isValid,
    errors,
  }
}
