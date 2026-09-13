// Pure helpers for the device enrollment flow: invitation parsing, lifecycle
// actions per auth status, one-time code countdown and confirmation copy.
// Kept free of React/DOM so both server actions and components can share them.

import {
  AUTH_STATUS_LABELS,
  type AuthStatus,
  type Device,
  type EnrollmentCancelResult,
  type EnrollmentInvitation,
} from "@/lib/devices-data"

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value))
}

function dataFromResponse(payload: unknown): unknown {
  if (!isRecord(payload)) return null
  if (payload.success !== true) return null
  return "data" in payload ? payload.data : null
}

/** Parses a single invitation; returns null if the shape is not trustworthy. */
export function parseEnrollmentInvitation(value: unknown): EnrollmentInvitation | null {
  if (!isRecord(value)) return null
  const enrollmentId = typeof value.enrollmentId === "string" ? value.enrollmentId : ""
  if (!enrollmentId) return null
  if (value.status !== "pending") return null
  if (!isValidIso(value.createdAt) || !isValidIso(value.expiresAt)) return null
  const dispositivoId =
    value.dispositivoId === null ? null : typeof value.dispositivoId === "string" ? value.dispositivoId : null
  const ubicacion = typeof value.ubicacion === "string" ? value.ubicacion : undefined
  const whepUrl = typeof value.whepUrl === "string" ? value.whepUrl : undefined
  const code = typeof value.code === "string" && value.code !== "" ? value.code : undefined
  return {
    enrollmentId,
    dispositivoId,
    nombre: typeof value.nombre === "string" ? value.nombre : "",
    ...(ubicacion !== undefined ? { ubicacion } : {}),
    ...(whepUrl !== undefined ? { whepUrl } : {}),
    status: "pending",
    ...(code !== undefined ? { code } : {}),
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  }
}

/** Parses the GET /enrollments envelope; null means a malformed response. */
export function parseEnrollmentInvitations(payload: unknown): EnrollmentInvitation[] | null {
  const data = dataFromResponse(payload)
  if (!Array.isArray(data)) return null
  const parsed = data.map(parseEnrollmentInvitation)
  return parsed.every((item): item is EnrollmentInvitation => item !== null) ? parsed : null
}

/** Parses the cancel response `{enrollmentId,status:"cancelled"}`. */
export function parseEnrollmentCancel(value: unknown): EnrollmentCancelResult | null {
  if (!isRecord(value)) return null
  if (typeof value.enrollmentId !== "string" || value.enrollmentId === "") return null
  if (value.status !== "cancelled") return null
  return { enrollmentId: value.enrollmentId, status: "cancelled" }
}

export type LifecycleAction = "enable" | "disable" | "revoke" | "reprovision"

/**
 * Lifecycle actions offered for a given credential state. Mirrors the backend
 * transitions exactly so the menu never offers an action that is guaranteed to
 * return 409 `invalid_lifecycle_transition`:
 *
 * | authStatus  | disable | enable | revoke | reprovision |
 * | ----------- | ------- | ------ | ------ | ----------- |
 * | unenrolled  |    -    |   -    |   -    |     si      |
 * | active      |   si    |   -    |   si   |     si      |
 * | disabled    |    -    |   si   |   si   |     si      |
 * | revoked     |    -    |   -    |   -    |     si      |
 *
 * `runLifecycle` in the backend only allows disable for active/disabled, enable
 * for disabled/active and revoke for active/disabled/revoked (same-state calls
 * are idempotent); every one of those is invalid for `unenrolled`. Reprovision
 * has no auth-status gate and is valid for any existing catalog device.
 */
export function lifecycleActionsFor(authStatus: AuthStatus): LifecycleAction[] {
  const actions: LifecycleAction[] = []
  if (authStatus === "active") actions.push("disable")
  if (authStatus === "disabled") actions.push("enable")
  if (authStatus === "active" || authStatus === "disabled") actions.push("revoke")
  actions.push("reprovision")
  return actions
}

export const LIFECYCLE_LABELS: Record<LifecycleAction, string> = {
  enable: "Habilitar",
  disable: "Deshabilitar",
  revoke: "Revocar credencial",
  reprovision: "Reprovisionar",
}

export type ConfirmationCopy = { title: string; description: string; confirm: string }

/** Confirmation for revoke: the old credential is invalidated immediately. */
export function revokeConfirmation(nombre: string): ConfirmationCopy {
  return {
    title: "¿Revocar la credencial de este nodo?",
    description:
      `La credencial actual de ${nombre} quedará invalidada de inmediato: el nodo no podrá ` +
      "autenticarse ni reportar hasta que se lo reprovisione. Esta acción no se puede deshacer.",
    confirm: "Revocar credencial",
  }
}

/** Confirmation for reprovision: a new key replaces the old one right away. */
export function reprovisionConfirmation(nombre: string): ConfirmationCopy {
  return {
    title: "¿Reprovisionar este nodo?",
    description:
      `Se invalidará de inmediato la credencial anterior de ${nombre} y se emitirá un ` +
      "código nuevo de uso único. El nodo dejará de autenticarse con la credencial vieja apenas " +
      "se confirme. El código se muestra una sola vez.",
    confirm: "Generar código nuevo",
  }
}

export type Remaining = { expired: boolean; ms: number; label: string }

/** Human countdown for an invitation expiry, using es-AR phrasing. */
export function enrollmentRemaining(expiresAt: string, now: number = Date.now()): Remaining {
  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return { expired: true, ms: 0, label: "Vencimiento desconocido" }
  const ms = expires - now
  if (ms <= 0) return { expired: true, ms: 0, label: "Vencida" }
  if (ms < 60000) return { expired: false, ms, label: "Vence en menos de 1 min" }
  const minutes = Math.ceil(ms / 60000)
  if (minutes < 60) return { expired: false, ms, label: `Vence en ${minutes} min` }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return { expired: false, ms, label: rest === 0 ? `Vence en ${hours} h` : `Vence en ${hours} h ${rest} min` }
}

/** True when an invitation will expire within `thresholdMs` (default 2 min). */
export function isEnrollmentStale(
  expiresAt: string,
  now: number = Date.now(),
  thresholdMs = 2 * 60 * 1000,
): boolean {
  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return true
  const ms = expires - now
  return ms > 0 && ms <= thresholdMs
}

/** Short es-AR clock for an invitation expiry (e.g. "18:42"). */
export function enrollmentExpiryClock(expiresAt: string): string {
  const date = new Date(expiresAt)
  if (!Number.isFinite(date.getTime())) return "—"
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
}

/** Label for the auth status, guarding against malformed values. */
export function authStatusLabel(authStatus: AuthStatus | undefined): string {
  return AUTH_STATUS_LABELS[authStatus ?? "unenrolled"]
}

/** Whether a node can authenticate/report with its current credential. */
export function canAuthenticate(device: Pick<Device, "authStatus">): boolean {
  return (device.authStatus ?? "unenrolled") === "active"
}
