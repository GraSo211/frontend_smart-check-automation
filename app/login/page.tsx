import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Iniciar Sesión | Smart-Check Automation',
  description:
    'Accedé al panel de supervisión de producción con tu cuenta corporativa de Google.',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <LoginForm />
    </div>
  )
}
