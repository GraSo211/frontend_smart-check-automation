import type { UserRole } from "@/lib/auth"

// ─── Colores del badge de rol ─────────────────────────────────────────────────

export const ROLE_COLORS: Record<UserRole, string> = {
  Administrador:
    "bg-violet-950/40 text-violet-300 ring-violet-700",
  Supervisor:
    "bg-blue-950/40 text-blue-300 ring-blue-700",
  Operario:
    "bg-emerald-950/40 text-emerald-300 ring-emerald-700",
}
