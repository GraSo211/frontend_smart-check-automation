// Pure helpers for the device registration-request flow: parsing of the
// backend envelopes (list, approve, reject) and expiry countdown copy.
// Kept free of React/DOM so both server actions and components can share them.

import {
  AUTH_STATUS_LABELS,
  type AuthStatus,
  type Device,
  type RegistrationApproval,
  type RegistrationRejection,
  type RegistrationRequest,
  type RegistrationRequestStatus,
} from "@/lib/devices-data"
import { APP_TIME_ZONE } from "@/lib/format"

export type Remaining = { expired: boolean; ms: number; label: string }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value))
}

const REGISTRATION_STATUSES: readonly RegistrationRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
]

function parseRegistrationStatus(value: unknown): RegistrationRequestStatus | null {
  return typeof value === "string" && (REGISTRATION_STATUSES as readonly string[]).includes(value)
    ? (value as RegistrationRequestStatus)
    : null
}

/** Parses a single registration request; null means the shape is untrustworthy. */
export function parseRegistrationRequest(value: unknown): RegistrationRequest | null {
  if (!isRecord(value)) return null
  const requestId = typeof value.requestId === "string" ? value.requestId : ""
  if (!requestId) return null
  const status = parseRegistrationStatus(value.status)
  if (status === null) return null
  if (typeof value.hostname !== "string" || value.hostname === "") return null
  if (!isValidIso(value.createdAt) || !isValidIso(value.expiresAt)) return null
  const deviceId =
    typeof value.deviceId === "string" && value.deviceId !== "" ? value.deviceId : undefined
  return {
    requestId,
    hostname: value.hostname,
    status,
    ...(deviceId !== undefined ? { deviceId } : {}),
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  }
}

/** Parses the GET /api/v1/registration-requests envelope; null means malformed. */
export function parseRegistrationRequests(payload: unknown): RegistrationRequest[] | null {
  if (!isRecord(payload) || payload.success !== true) return null
  const data = payload.data
  if (!Array.isArray(data)) return null
  const parsed = data.map(parseRegistrationRequest)
  return parsed.every((item): item is RegistrationRequest => item !== null) ? parsed : null
}

/**
 * Parses the approve response. The backend sends `data` in SNAKE_CASE
 * (`{request_id, status:"APPROVED", device_id}`); it is normalized to the
 * camelCase `RegistrationApproval` shape used by the UI.
 */
export function parseRegistrationApproval(value: unknown): RegistrationApproval | null {
  if (!isRecord(value)) return null
  const requestId = typeof value.request_id === "string" ? value.request_id : ""
  if (!requestId) return null
  if (value.status !== "APPROVED") return null
  const deviceId = typeof value.device_id === "string" ? value.device_id : ""
  if (!deviceId) return null
  return { requestId, status: "APPROVED", deviceId }
}

/** Parses the reject response `{requestId, status:"REJECTED"}` (camelCase). */
export function parseRegistrationRejection(value: unknown): RegistrationRejection | null {
  if (!isRecord(value)) return null
  const requestId = typeof value.requestId === "string" ? value.requestId : ""
  if (!requestId) return null
  if (value.status !== "REJECTED") return null
  return { requestId, status: "REJECTED" }
}

/** Human countdown for a registration request expiry, using es-AR phrasing. */
export function registrationRemaining(expiresAt: string, now: number = Date.now()): Remaining {
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

/** True when a registration request will expire within `thresholdMs` (default 2 min). */
export function isRegistrationStale(
  expiresAt: string,
  now: number = Date.now(),
  thresholdMs = 2 * 60 * 1000,
): boolean {
  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return true
  const ms = expires - now
  return ms > 0 && ms <= thresholdMs
}

/** Short es-AR clock for a registration request expiry (e.g. "18:42", Buenos Aires time). */
export function registrationExpiryClock(expiresAt: string): string {
  const date = new Date(expiresAt)
  if (!Number.isFinite(date.getTime())) return "—"
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: APP_TIME_ZONE })
}

/** Label for the auth status, guarding against malformed values. */
export function authStatusLabel(authStatus: AuthStatus | undefined): string {
  return AUTH_STATUS_LABELS[authStatus ?? "unenrolled"]
}

/** Whether a node can authenticate/report with its current credential. */
export function canAuthenticate(device: Pick<Device, "authStatus">): boolean {
  return (device.authStatus ?? "unenrolled") === "active"
}
