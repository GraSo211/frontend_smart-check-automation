import { describe, expect, it } from "vitest"
import {
  buildUpdateNotificationPreferencesBody,
  CHANNEL_LABELS,
  isValidTelegramChatId,
  normalizeTelegramChatId,
  parseNotificationRecipient,
  parseNotificationSettingsData,
  ROLE_LABELS,
} from "@/lib/notification-settings"

function validPayload() {
  return {
    canales: {
      email: { configurado: true, remitente: "alertas@fermar.com" },
      telegram: { configurado: false },
    },
    destinatarios: [
      {
        usuario_id: "u-1",
        email: "admin@fermar.com",
        nombre: "Admin Uno",
        rol: "Administrador",
        activo: true,
        telegram_chat_id: "123456789",
        notificar_email: true,
        notificar_telegram: false,
      },
      {
        usuario_id: "u-2",
        email: "sup@fermar.com",
        nombre: "Supervisor Dos",
        rol: "Supervisor",
        activo: true,
        telegram_chat_id: null,
        notificar_email: true,
        notificar_telegram: true,
      },
      {
        usuario_id: "u-3",
        email: "op@fermar.com",
        nombre: "Operario Tres",
        rol: "Operario",
        activo: false,
        telegram_chat_id: "-9876543210",
        notificar_email: false,
        notificar_telegram: false,
      },
    ],
  }
}

describe("notification-settings", () => {
  describe("isValidTelegramChatId", () => {
    it("acepta IDs de usuario entre 5 y 20 dígitos", () => {
      expect(isValidTelegramChatId("12345")).toBe(true)
      expect(isValidTelegramChatId("12345678901234567890")).toBe(true)
    })

    it("acepta IDs de grupo que empiezan con '-';", () => {
      expect(isValidTelegramChatId("-12345")).toBe(true)
      expect(isValidTelegramChatId("-9876543210123456789")).toBe(true)
    })

    it("rechaza valores nulos o vacíos", () => {
      expect(isValidTelegramChatId(null)).toBe(false)
      expect(isValidTelegramChatId(undefined)).toBe(false)
      expect(isValidTelegramChatId("")).toBe(false)
    })

    it("rechaza letras, espacios y otros caracteres", () => {
      expect(isValidTelegramChatId("abc123")).toBe(false)
      expect(isValidTelegramChatId("12 345")).toBe(false)
      expect(isValidTelegramChatId("12345.6")).toBe(false)
      expect(isValidTelegramChatId("+12345")).toBe(false)
    })

    it("rechaza IDs muy cortos o muy largos", () => {
      expect(isValidTelegramChatId("1234")).toBe(false)
      expect(isValidTelegramChatId("123456789012345678901")).toBe(false)
    })
  })

  describe("normalizeTelegramChatId", () => {
    it("convierte strings vacíos o solo espacios en null", () => {
      expect(normalizeTelegramChatId("")).toBeNull()
      expect(normalizeTelegramChatId("   ")).toBeNull()
    })

    it("recorta espacios laterales", () => {
      expect(normalizeTelegramChatId("  12345  ")).toBe("12345")
    })

    it("devuelve null para valores nulos", () => {
      expect(normalizeTelegramChatId(null)).toBeNull()
      expect(normalizeTelegramChatId(undefined)).toBeNull()
    })
  })

  describe("parseNotificationSettingsData", () => {
    it("parsea la respuesta completa del backend", () => {
      const result = parseNotificationSettingsData(validPayload())

      expect(result.channels.email).toEqual({
        configured: true,
        sender: "alertas@fermar.com",
      })
      expect(result.channels.telegram).toEqual({ configured: false })
      expect(result.recipients).toHaveLength(3)
      expect(result.recipients[0]).toEqual({
        userId: "u-1",
        email: "admin@fermar.com",
        nombre: "Admin Uno",
        rol: "Administrador",
        activo: true,
        telegramChatId: "123456789",
        notifyEmail: true,
        notifyTelegram: false,
      })
    })

    it("normaliza chat IDs vacíos a null", () => {
      const payload = validPayload()
      payload.destinatarios[0].telegram_chat_id = ""

      const result = parseNotificationSettingsData(payload)

      expect(result.recipients[0].telegramChatId).toBeNull()
    })

    it("falla si canales no es un objeto", () => {
      expect(() =>
        parseNotificationSettingsData({ canales: null, destinatarios: [] }),
      ).toThrow("canales inválidos")
    })

    it("falla si falta un canal", () => {
      const payload = validPayload()
      delete (payload.canales as Record<string, unknown>).email

      expect(() => parseNotificationSettingsData(payload)).toThrow(
        "canal email inválido",
      )
    })

    it("falla si destinatarios no es un array", () => {
      const payload = validPayload()
      payload.destinatarios = null as unknown as typeof payload.destinatarios

      expect(() => parseNotificationSettingsData(payload)).toThrow(
        "destinatarios debe ser un array",
      )
    })
  })

  describe("parseNotificationRecipient", () => {
    it("falla si falta usuario_id", () => {
      expect(() =>
        parseNotificationRecipient({
          usuario_id: "",
          email: "a@b.com",
          nombre: "N",
          rol: "Operario",
          activo: true,
          telegram_chat_id: null,
          notificar_email: true,
          notificar_telegram: false,
        }),
      ).toThrow("usuario_id es requerido")
    })

    it("falla si el rol no es válido", () => {
      expect(() =>
        parseNotificationRecipient({
          usuario_id: "u-1",
          email: "a@b.com",
          nombre: "N",
          rol: "Gerente",
          activo: true,
          telegram_chat_id: null,
          notificar_email: true,
          notificar_telegram: false,
        }),
      ).toThrow("rol inválido")
    })

    it("falla si notificar_email no es boolean", () => {
      expect(() =>
        parseNotificationRecipient({
          usuario_id: "u-1",
          email: "a@b.com",
          nombre: "N",
          rol: "Operario",
          activo: true,
          telegram_chat_id: null,
          notificar_email: "sí",
          notificar_telegram: false,
        }),
      ).toThrow("notificar_email debe ser boolean")
    })
  })

  describe("buildUpdateNotificationPreferencesBody", () => {
    it("mapea camelCase a snake_case y normaliza chat ID vacío", () => {
      const body = buildUpdateNotificationPreferencesBody({
        telegramChatId: "",
        notifyEmail: true,
        notifyTelegram: false,
      })

      expect(body).toEqual({
        telegram_chat_id: "",
        notificar_email: true,
        notificar_telegram: false,
      })
    })

    it("omite campos undefined", () => {
      const body = buildUpdateNotificationPreferencesBody({
        telegramChatId: "12345",
      })

      expect(body).toEqual({ telegram_chat_id: "12345" })
    })
  })

  describe("labels", () => {
    it("expone labels para canales", () => {
      expect(CHANNEL_LABELS.EMAIL).toBe("Email")
      expect(CHANNEL_LABELS.TELEGRAM).toBe("Telegram")
    })

    it("expone labels para roles", () => {
      expect(ROLE_LABELS.Administrador).toBe("Administrador")
      expect(ROLE_LABELS.Supervisor).toBe("Supervisor")
      expect(ROLE_LABELS.Operario).toBe("Operario")
    })
  })
})
