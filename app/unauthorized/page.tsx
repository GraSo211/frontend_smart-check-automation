import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldX, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Acceso Denegado | Smart-Check Automation',
  description: 'No tenés permisos para acceder a esta sección.',
}

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        {/* Ícono */}
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
          <ShieldX className="size-10 text-destructive" aria-hidden="true" />
        </div>

        {/* Texto */}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Acceso Denegado
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No tenés los permisos necesarios para acceder a esta sección. Si creés
          que esto es un error, contactá a tu administrador.
        </p>

        {/* Acciones */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            id="link-back-dashboard"
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
