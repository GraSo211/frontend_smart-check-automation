import type { UserRole } from "@/lib/auth"

// ─── Tipos del dominio (camelCase) ───────────────────────────────────────────

export type NotificationChannel = "EMAIL" | "TELEGRAM"

export interface NotificationChannelStatus {
  configured: boolean
  sender?: string | null
}

export interface NotificationRecipient {
  userId: string
  email: string
  nombre: string
  rol: UserRole
  activo: boolean
  telegramChatId: string | null
  notifyEmail: boolean
  notifyTelegram: boolean
}

export interface NotificationSettingsData {
  channels: {
    email: NotificationChannelStatus
    telegram: NotificationChannelStatus
  }
  recipients: NotificationRecipient[]
}

// ─── Tipos crudos del backend (snake_case) ───────────────────────────────────

export interface NotificationChannelStatusPayload {
  configurado: boolean
  remitente?: string | null
}

export interface NotificationRecipientPayload {
  usuario_id: string
  email: string
  nombre: string
  rol: string
  activo: boolean
  telegram_chat_id: string | null
  notificar_email: boolean
  notificar_telegram: boolean
}

export interface NotificationSettingsPayload {
  canales: {
    email: NotificationChannelStatusPayload
    telegram: NotificationChannelStatusPayload
  }
  destinatarios: NotificationRecipientPayload[]
}

// ─── Constantes de UI ────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "Email",
  TELEGRAM: "Telegram",
}

export const ROLE_LABELS: Record<UserRole, string> = {
  Administrador: "Administrador",
  Supervisor: "Supervisor",
  Operario: "Operario",
}

const ROLES: readonly UserRole[] = ["Administrador", "Supervisor", "Operario"]

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null
}

// ─── Validación ──────────────────────────────────────────────────────────────

/**
 * Valida un chat ID de Telegram según el contrato del backend.
 * Acepta entre 5 y 20 dígitos, opcionalmente con signo menos al inicio.
 */
export function isValidTelegramChatId(value: string | null | undefined): boolean {
  if (value == null) return false
  return /^-?[0-9]{5,20}$/.test(value)
}

/**
 * Normaliza un chat ID de Telegram: convierte strings vacíos en `null`.
 */
export function normalizeTelegramChatId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseChannelStatus(
  raw: unknown,
  channelName: string,
): NotificationChannelStatus {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`canal ${channelName} inválido`)
  }
  const obj = raw as Record<string, unknown>
  if (!isBoolean(obj.configurado)) {
    throw new Error(`canal ${channelName}: configurado debe ser boolean`)
  }
  return {
    configured: obj.configurado,
    sender: typeof obj.remitente === "string" || obj.remitente === null
      ? obj.remitente
      : undefined,
  }
}

export function parseNotificationRecipient(raw: unknown): NotificationRecipient {
  if (raw === null || typeof raw !== "object") {
    throw new Error("destinatario inválido")
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.usuario_id !== "string" || obj.usuario_id === "") {
    throw new Error("destinatario: usuario_id es requerido")
  }
  if (typeof obj.email !== "string" || obj.email === "") {
    throw new Error("destinatario: email es requerido")
  }
  if (typeof obj.nombre !== "string" || obj.nombre === "") {
    throw new Error("destinatario: nombre es requerido")
  }
  if (!isUserRole(obj.rol)) {
    throw new Error("destinatario: rol inválido")
  }
  if (!isBoolean(obj.activo)) {
    throw new Error("destinatario: activo debe ser boolean")
  }
  if (!isStringOrNull(obj.telegram_chat_id)) {
    throw new Error("destinatario: telegram_chat_id debe ser string o null")
  }
  if (!isBoolean(obj.notificar_email)) {
    throw new Error("destinatario: notificar_email debe ser boolean")
  }
  if (!isBoolean(obj.notificar_telegram)) {
    throw new Error("destinatario: notificar_telegram debe ser boolean")
  }

  return {
    userId: obj.usuario_id,
    email: obj.email,
    nombre: obj.nombre,
    rol: obj.rol,
    activo: obj.activo,
    telegramChatId: normalizeTelegramChatId(obj.telegram_chat_id),
    notifyEmail: obj.notificar_email,
    notifyTelegram: obj.notificar_telegram,
  }
}

export function parseNotificationSettingsData(raw: unknown): NotificationSettingsData {
  if (raw === null || typeof raw !== "object") {
    throw new Error("respuesta inválida: se esperaba un objeto")
  }
  const obj = raw as Record<string, unknown>

  if (obj.canales === null || typeof obj.canales !== "object") {
    throw new Error("canales inválidos")
  }
  const canales = obj.canales as Record<string, unknown>

  const email = parseChannelStatus(canales.email, "email")
  const telegram = parseChannelStatus(canales.telegram, "telegram")

  if (!Array.isArray(obj.destinatarios)) {
    throw new Error("destinatarios debe ser un array")
  }

  return {
    channels: { email, telegram },
    recipients: obj.destinatarios.map(parseNotificationRecipient),
  }
}

// ─── Serialización hacia el backend ──────────────────────────────────────────

export interface UpdateNotificationPreferencesInput {
  telegramChatId?: string | null
  notifyEmail?: boolean
  notifyTelegram?: boolean
}

export function buildUpdateNotificationPreferencesBody(
  input: UpdateNotificationPreferencesInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (input.telegramChatId !== undefined) {
    // El backend distingue "campo omitido" (no cambiar) de "" (borrar); null
    // se interpretaría como campo omitido y no borraría nada.
    body.telegram_chat_id = normalizeTelegramChatId(input.telegramChatId) ?? ""
  }
  if (input.notifyEmail !== undefined) {
    body.notificar_email = input.notifyEmail
  }
  if (input.notifyTelegram !== undefined) {
    body.notificar_telegram = input.notifyTelegram
  }
  return body
}
