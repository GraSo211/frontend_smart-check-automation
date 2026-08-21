'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { loginWithGoogleAction, loginWithLocalAction } from '@/actions/auth'
import { validateEmail, validatePassword } from '@/lib/auth-validation'
import { AlertCircle, Loader2, ShieldCheck, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

// ─── Formulario de Login Local (Email / Password) ─────────────────────────────

function LocalLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)

    // Validaciones de formato en cliente
    const emailVal = validateEmail(email)
    const passVal = validatePassword(password)

    if (!emailVal.isValid || !passVal.isValid) {
      setFieldErrors({
        email: emailVal.error,
        password: passVal.error,
      })
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      const result = await loginWithLocalAction(email, password)

      if (result.ok) {
        router.replace('/')
      } else if (result.errors) {
        setFieldErrors(result.errors)
      } else {
        setGeneralError(result.message ?? 'Error al iniciar sesión. Intentá nuevamente.')
      }
    } catch {
      setGeneralError('Error inesperado de conexión. Intentá nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4" noValidate>
      {/* Alerta de error general */}
      {generalError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Input Email */}
      <div className="space-y-1.5">
        <label htmlFor="input-email" className="block text-xs font-semibold text-foreground">
          Correo Electrónico Corporativo
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="input-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="usuario@fermar.com"
            disabled={isLoading}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'error-email' : undefined}
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
          />
        </div>
        {fieldErrors.email && (
          <p id="error-email" className="text-xs font-medium text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* Input Contraseña */}
      <div className="space-y-1.5">
        <label htmlFor="input-password" className="block text-xs font-semibold text-foreground">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="input-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isLoading}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'error-password' : undefined}
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-10 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="error-password" className="text-xs font-medium text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Botón submit local */}
      <Button
        id="btn-local-login"
        type="submit"
        disabled={isLoading}
        className="mt-2 h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-md"
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="size-4" aria-hidden="true" />
        )}
        <span>{isLoading ? 'Autenticando…' : 'Iniciar Sesión'}</span>
      </Button>
    </form>
  )
}

// ─── Componente Google Login ──────────────────────────────────────────────────

function GoogleLoginContainer() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSuccess = async (googleToken: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await loginWithGoogleAction(googleToken)

      if (result.ok) {
        router.replace('/')
      } else {
        setError(result.message ?? 'Error al iniciar sesión. Intentá nuevamente.')
      }
    } catch {
      setError('Error inesperado. Intentá nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 items-center">
      {error && (
        <div
          role="alert"
          className="flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="w-full flex justify-center">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              handleGoogleSuccess(credentialResponse.credential)
            } else {
              setError('No se recibió el token de Google. Intentá nuevamente.')
            }
          }}
          onError={() => {
            setError('Error al conectar con Google. Intentá nuevamente.')
          }}
          theme="filled_blue"
          shape="pill"
          size="large"
          text="continue_with"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Validando credenciales de Google…</span>
        </div>
      )}
    </div>
  )
}

// ─── Componente Principal LoginForm ──────────────────────────────────────────

export function LoginForm() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="w-full max-w-md">
        {/* Card principal */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          {/* Logo y branding */}
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 p-2 shadow-sm ring-1 ring-primary/20">
              <Image
                src="/Isotipo ⁄ Icono.webp"
                alt="Smart-Check Automation"
                width={36}
                height={48}
                className="h-full w-auto object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Smart-Check Automation
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Fermar S.A. — Control de Calidad y Telemetría
              </p>
            </div>
          </div>

          {/* Formulario Local */}
          <LocalLoginForm />

          {/* Separador */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="absolute bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              o continuar con
            </span>
          </div>

          {/* Login de Google */}
          <GoogleLoginContainer />

          {/* Nota de seguridad */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>Acceso seguro mediante JWT y cookies corporativas.</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Smart-Check Automation · Fermar S.A.
        </p>
      </div>
    </GoogleOAuthProvider>
  )
}
