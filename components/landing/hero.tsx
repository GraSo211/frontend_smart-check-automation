import Image from 'next/image'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CapabilityChips } from './capability-chips'

export function Hero() {
  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:py-20">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[28rem] w-[40rem] rounded-full bg-primary/10 blur-[120px]"
        />
        <div
          className="absolute -bottom-48 -right-32 h-[26rem] w-[34rem] rounded-full bg-accent/10 blur-[100px]"
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        {/* Eyebrow */}
        <div
          className="mb-6 inline-flex items-center gap-3 rounded-full border border-sidebar/20 bg-sidebar-foreground px-4 py-2 text-sidebar"
        >
          <Image
            src="/fermar/imagotipo-principal.webp"
            alt=""
            width={45}
            height={20}
            className="h-5 w-auto"
            priority
          />
          <span className="text-sm font-medium text-sidebar/80">
            Fermar S.A.
            <span className="hidden sm:inline"> · Supervisión de producción</span>
          </span>
        </div>

        {/* Title */}
        <h1
          className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
        >
          SmartCheck Automation
        </h1>

        {/* Slogan */}
        <p
          className="mt-6 max-w-3xl text-balance font-heading text-2xl font-medium leading-snug text-foreground dark:text-primary sm:text-3xl md:text-4xl"
        >
          La calidad no se audita al final. Se ve en cada lote.
        </p>

        {/* Bajada */}
        <p
          className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Supervisión en tiempo real de lotes, hornos y dispositivos IoT Edge para
          la panificadora industrial Fermar S.A.
        </p>

        {/* CTA */}
        <div
          className="mt-9 flex flex-col items-center gap-3"
        >
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'h-11 px-7 text-base shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            Iniciar sesión
          </Link>
          <span className="text-xs text-muted-foreground">
            Acceso con cuenta corporativa
          </span>
        </div>

        {/* Capabilities */}
        <div className="mt-10">
          <CapabilityChips />
        </div>
      </div>
    </main>
  )
}
