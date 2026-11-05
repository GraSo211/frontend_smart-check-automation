import Image from 'next/image'

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="text-sm text-muted-foreground">
          Smart-Check Automation © 2026 · Desarrollado por SmarTeam
        </p>
        <div className="rounded-lg bg-sidebar-foreground p-2">
          <Image
            src="/sca/logo_image_only.svg"
            alt=""
            width={36}
            height={18}
            className="h-5 w-auto"
          />
        </div>
      </div>
    </footer>
  )
}
