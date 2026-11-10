const capabilities = [
  'Lotes en tiempo real',
  'Telemetría de horno',
  'Alertas operativas',
  'Video en vivo',
]

export function CapabilityChips() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-3">
      {capabilities.map((label) => (
        <li
          key={label}
          className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium text-card-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          {label}
        </li>
      ))}
    </ul>
  )
}
