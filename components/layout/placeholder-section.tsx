import { Construction } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type PlaceholderSectionProps = {
  icon: LucideIcon
  title: string
  description: string
}

export function PlaceholderSection({
  icon: Icon,
  title,
  description,
}: PlaceholderSectionProps) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-balance text-xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="size-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Próximamente
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Esta sección está planificada para un futuro sprint del proyecto.
              Mientras tanto podés explorar el resto del panel de control.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Construction className="size-3.5" aria-hidden="true" />
            Sección en desarrollo
          </span>
        </div>
      </div>
    </main>
  )
}
