"use client"

import { useEffect, useState } from "react"
import { Check, Copy, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { enrollmentExpiryClock, enrollmentRemaining } from "@/lib/enrollment"

interface EnrollmentCodePanelProps {
  /** Código de aprovisionamiento. Se muestra una sola vez. */
  code: string
  expiresAt: string
  /** Nombre del nodo al que pertenece la invitación, si se conoce. */
  nombre?: string
  className?: string
  /** Reloj inyectable para pruebas deterministas. */
  now?: number
}

// Displays the one-time provisioning code with a copy action, a live countdown
// and the operational instructions for the Raspberry. The code is never
// persisted: when the invitation expires it is removed from the UI.
export function EnrollmentCodePanel({ code, expiresAt, nombre, className, now }: EnrollmentCodePanelProps) {
  const [clock, setClock] = useState(() => now ?? Date.now())
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    if (now !== undefined) return
    const id = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [now])

  const remaining = enrollmentRemaining(expiresAt, clock)

  const handleCopy = async () => {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
      setCopyError("No se pudo copiar automáticamente. Seleccioná el código y copialo a mano.")
    }
  }

  if (remaining.expired) {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning",
          className,
        )}
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          La invitación venció y el código ya no es válido. Cerrá esta ventana y generá una nueva
          solicitud de enrolamiento.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)} role="group" aria-label="Código de aprovisionamiento">
      <div className="relative overflow-hidden rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Código de uso único
          </span>
          <span
            role="timer"
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              remaining.ms <= 2 * 60 * 1000
                ? "bg-warning/15 text-warning"
                : "bg-secondary/70 text-muted-foreground",
            )}
          >
            {remaining.label} · vence {enrollmentExpiryClock(expiresAt)} UTC
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <code
            aria-label="Código de aprovisionamiento"
            className="min-w-0 flex-1 select-all break-all rounded-lg bg-card px-3 py-2 font-mono text-sm tracking-tight text-foreground ring-1 ring-border"
          >
            {code}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={handleCopy} aria-label="Copiar código">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-muted-foreground">
          {copyError ?? (copied ? "Código copiado al portapapeles." : "")}
        </p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {nombre ? `Ingresá el código en la Raspberry de ${nombre}.` : "Ingresá el código en la Raspberry."}
        </p>
        <ul className="space-y-1.5 text-xs leading-relaxed">
          <li className="flex gap-2">
            <span className="text-primary" aria-hidden="true">1.</span>
            <span>
              Por CLI: <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono">python -m device_enrollment enroll</code>{" "}
              (el código se lee desde el archivo de entorno o con un prompt sin eco, nunca como argumento).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary" aria-hidden="true">2.</span>
            <span>
              O bien definí <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono">DEVICE_ENROLLMENT_CODE</code> en el
              archivo <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono">.env</code> del dispositivo.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary" aria-hidden="true">3.</span>
            <span>
              El código es temporal y de un solo uso. No se guarda en el navegador y no se puede volver a
              mostrar: si vence, generá una nueva solicitud.
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
