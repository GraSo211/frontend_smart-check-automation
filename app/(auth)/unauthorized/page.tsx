import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldX, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Acceso Denegado | Smart-Check Automation',
  description: 'No tenés permisos para acceder a esta sección.',
}

export default function UnauthorizedPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Fondo decorativo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-destructive/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl sm:p-10">
        {/* Ícono */}
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
          <ShieldX className="size-8 text-destructive" aria-hidden="true" />
        </div>

        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Control de Acceso
        </div>

        {/* Texto */}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Acceso Denegado
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          No tenés los permisos necesarios para acceder a esta sección. Si creés
          que esto es un error, contactá a tu administrador.
        </p>

        {/* Acciones */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            id="link-back-dashboard"
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
