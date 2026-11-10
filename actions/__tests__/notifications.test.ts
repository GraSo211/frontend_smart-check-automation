import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.hoisted(() =>
  vi.fn(async () => ({
    get: vi.fn(() => ({ value: "jwt-token" })),
  })),
)
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
  })
}

const validRecipient = {
  usuario_id: "u-1",
  email: "admin@fermar.com",
  nombre: "Admin Uno",
  rol: "Administrador",
  activo: true,
  telegram_chat_id: "123456789",
  notificar_email: true,
  notificar_telegram: false,
}

const validSettingsEnvelope = {
  success: true,
  message: "ok",
  data: {
    canales: {
      email: { configurado: true, remitente: "alertas@fermar.com" },
      telegram: { configurado: false },
    },
    destinatarios: [validRecipient],
  },
}

describe("notification actions", () => {
  let actions: typeof import("../notifications")
  const fetchMock = vi.fn()

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test"
    vi.stubGlobal("fetch", fetchMock)
    actions = await import("../notifications")
  })

  beforeEach(() => {
    fetchMock.mockReset()
    revalidatePathMock.mockReset()
  })

  describe("getNotificationSettingsAction", () => {
    it("obtiene y parsea la configuración de notificaciones", async () => {
      fetchMock.mockResolvedValue(json(validSettingsEnvelope))

      const result = await actions.getNotificationSettingsAction()

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.channels.email).toEqual({
        configured: true,
        sender: "alertas@fermar.com",
      })
      expect(result.data.recipients[0].userId).toBe("u-1")
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://backend.example.test/api/v1/admin/notificaciones",
      )
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        "Content-Type": "application/json",
        Cookie: "session_token=jwt-token",
      })
      expect(fetchMock.mock.calls[0][1].cache).toBe("no-store")
    })

    it("devuelve error de sesión en 401", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 401))

      const result = await actions.getNotificationSettingsAction()

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain("Sesión expirada")
    })

    it("propaga timeout a un mensaje claro", async () => {
      vi.useFakeTimers()
      fetchMock.mockImplementation((_url: string, options: RequestInit) =>
        new Promise((_, reject) => {
          options.signal?.addEventListener("abort", () => {
            const error = new Error("aborted")
            error.name = "AbortError"
            reject(error)
          })
        }),
      )

      const promise = actions.getNotificationSettingsAction()
      await vi.advanceTimersByTimeAsync(8000)
      const result = await promise

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain("no respondió a tiempo")
      vi.useRealTimers()
    })

    it("falla si la respuesta está malformada", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: { canales: null } }))

      const result = await actions.getNotificationSettingsAction()

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain("canales inválidos")
    })
  })

  describe("updateNotificationPreferencesAction", () => {
    it("hace PATCH con el payload mapeado a snake_case y revalida", async () => {
      fetchMock.mockResolvedValue(json({
        success: true,
        message: "ok",
        data: { ...validRecipient, telegram_chat_id: "", notificar_email: false },
      }))

      const result = await actions.updateNotificationPreferencesAction("u-1", {
        telegramChatId: "",
        notifyEmail: false,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipient?.telegramChatId).toBeNull()
      expect(result.recipient?.notifyEmail).toBe(false)
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://backend.example.test/api/v1/admin/notificaciones/u-1",
      )
      expect(fetchMock.mock.calls[0][1].method).toBe("PATCH")
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
        telegram_chat_id: "",
        notificar_email: false,
      })
      expect(revalidatePathMock).toHaveBeenCalledWith("/configuracion/notificaciones")
    })

    it("codifica el id de usuario en la ruta", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: validRecipient }))

      await actions.updateNotificationPreferencesAction("u/1", {
        notifyTelegram: true,
      })

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://backend.example.test/api/v1/admin/notificaciones/u%2F1",
      )
    })

    it("omite campos no enviados", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: validRecipient }))

      await actions.updateNotificationPreferencesAction("u-1", {
        notifyTelegram: true,
      })

      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
        notificar_telegram: true,
      })
    })

    it("traduce 404 a usuario no encontrado", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

      const result = await actions.updateNotificationPreferencesAction("u-1", {
        notifyEmail: false,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toBe("Usuario no encontrado.")
    })

    it("propaga el mensaje del backend en 409", async () => {
      fetchMock.mockResolvedValue(json({
        success: false,
        message: "Canal no configurado",
      }, 409))

      const result = await actions.updateNotificationPreferencesAction("u-1", {
        notifyEmail: true,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toBe("Canal no configurado")
    })
  })

  describe("sendTestNotificationAction", () => {
    it("hace POST con canal y usuario_id y usa timeout de 15s", async () => {
      fetchMock.mockResolvedValue(json({
        success: true,
        message: "Mensaje de prueba enviado.",
      }))

      const result = await actions.sendTestNotificationAction("u-1", "EMAIL")

      expect(result).toEqual({
        ok: true,
        message: "Mensaje de prueba enviado.",
      })
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://backend.example.test/api/v1/admin/notificaciones/test",
      )
      expect(fetchMock.mock.calls[0][1].method).toBe("POST")
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
        canal: "EMAIL",
        usuario_id: "u-1",
      })
    })

    it("traduce 502 a fallo del proveedor", async () => {
      fetchMock.mockResolvedValue(json({
        success: false,
        message: "",
      }, 502))

      const result = await actions.sendTestNotificationAction("u-1", "TELEGRAM")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain("proveedor")
    })

    it("responde con mensaje de sesión expirada en 401", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 401 }))

      const result = await actions.sendTestNotificationAction("u-1", "EMAIL")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain("Sesión expirada")
    })

    it("propaga el timeout del test a un mensaje claro", async () => {
      vi.useFakeTimers()
      fetchMock.mockImplementation((_url: string, options: RequestInit) =>
        new Promise((_, reject) => {
          options.signal?.addEventListener("abort", () => {
            const error = new Error("aborted")
            error.name = "AbortError"
            reject(error)
          })
        }),
      )

      const promise = actions.sendTestNotificationAction("u-1", "TELEGRAM")
      await vi.advanceTimersByTimeAsync(15000)
      const result = await promise

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain("no respondió a tiempo")
      vi.useRealTimers()
    })
  })
})
