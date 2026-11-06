// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { NotificationSettings } from "@/components/notificaciones/notification-settings"
import type { NotificationSettingsData } from "@/lib/notification-settings"

const mocks = vi.hoisted(() => ({
  getNotificationSettingsAction: vi.fn(),
  updateNotificationPreferencesAction: vi.fn(),
  sendTestNotificationAction: vi.fn(),
}))

vi.mock("@/actions/notifications", () => ({
  getNotificationSettingsAction: mocks.getNotificationSettingsAction,
  updateNotificationPreferencesAction: mocks.updateNotificationPreferencesAction,
  sendTestNotificationAction: mocks.sendTestNotificationAction,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function buildData(): NotificationSettingsData {
  return {
    channels: {
      email: { configured: true, sender: "alertas@fermar.com" },
      telegram: { configured: false },
    },
    recipients: [
      {
        userId: "u-1",
        email: "admin@fermar.com",
        nombre: "Admin Uno",
        rol: "Administrador",
        activo: true,
        telegramChatId: "12345",
        notifyEmail: true,
        notifyTelegram: false,
      },
      {
        userId: "u-2",
        email: "sup@fermar.com",
        nombre: "Supervisor Dos",
        rol: "Supervisor",
        activo: true,
        telegramChatId: null,
        notifyEmail: true,
        notifyTelegram: true,
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderComponent(props?: { data?: NotificationSettingsData; error?: string }) {
  return render(
    <NotificationSettings
      initialData={props?.data}
      initialError={props?.error}
    />,
  )
}

describe("NotificationSettings", () => {
  it("muestra las tarjetas de estado de canales", () => {
    renderComponent({ data: buildData() })

    expect(screen.getByRole("heading", { name: "Email", level: 3 })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Telegram", level: 3 })).toBeTruthy()
    expect(screen.getByText("Configurado")).toBeTruthy()
    expect(screen.getByText("Sin configurar")).toBeTruthy()
  })

  it("renderiza los destinatarios en la tabla de escritorio", () => {
    renderComponent({ data: buildData() })

    const table = screen.getByRole("table")
    expect(table.textContent).toContain("Admin Uno")
    expect(table.textContent).toContain("Supervisor Dos")
    expect(screen.getAllByLabelText(/Chat ID de Telegram/)).toHaveLength(4)
  })

  it("deshabilita el botón de probar Telegram cuando no hay chat ID", () => {
    renderComponent({ data: buildData() })

    const table = screen.getByRole("table")
    const rows = Array.from(table.querySelectorAll("tr"))
    const userRow = rows.find((row) => row.textContent?.includes("Supervisor Dos"))
    expect(userRow).toBeTruthy()
    const testTelegram = Array.from(userRow!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Probar Telegram"),
    )
    expect(testTelegram?.disabled).toBe(true)
  })

  it("habilita el botón de probar Telegram cuando hay chat ID", () => {
    renderComponent({ data: buildData() })

    const table = screen.getByRole("table")
    const rows = Array.from(table.querySelectorAll("tr"))
    const userRow = rows.find((row) => row.textContent?.includes("Admin Uno"))
    const testTelegram = Array.from(userRow!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Probar Telegram"),
    )
    expect(testTelegram?.disabled).toBe(false)
  })

  it("llama a guardar cuando se edita el chat ID y se clickea Guardar", async () => {
    mocks.updateNotificationPreferencesAction.mockResolvedValue({
      ok: true,
      recipient: {
        userId: "u-1",
        email: "admin@fermar.com",
        nombre: "Admin Uno",
        rol: "Administrador",
        activo: true,
        telegramChatId: "67890",
        notifyEmail: true,
        notifyTelegram: false,
      },
    })

    renderComponent({ data: buildData() })

    const input = screen.getAllByLabelText(/Chat ID de Telegram/)[0] as HTMLInputElement
    fireEvent.change(input, { target: { value: "67890" } })

    const table = screen.getByRole("table")
    const rows = Array.from(table.querySelectorAll("tr"))
    const userRow = rows.find((row) => row.textContent?.includes("Admin Uno"))
    const saveButton = Array.from(userRow!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Guardar"),
    )

    await act(async () => {
      fireEvent.click(saveButton!)
    })

    expect(mocks.updateNotificationPreferencesAction).toHaveBeenCalledWith("u-1", {
      telegramChatId: "67890",
      notifyEmail: undefined,
      notifyTelegram: undefined,
    })
    expect(toast.success).toHaveBeenCalledWith("Preferencias guardadas.")
  })

  it("llama a probar email con el usuario seleccionado", async () => {
    mocks.sendTestNotificationAction.mockResolvedValue({
      ok: true,
      message: "Mensaje enviado.",
    })

    renderComponent({ data: buildData() })

    const table = screen.getByRole("table")
    const rows = Array.from(table.querySelectorAll("tr"))
    const userRow = rows.find((row) => row.textContent?.includes("Admin Uno"))
    const testEmail = Array.from(userRow!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Probar email"),
    )

    await act(async () => {
      fireEvent.click(testEmail!)
    })

    expect(mocks.sendTestNotificationAction).toHaveBeenCalledWith("u-1", "EMAIL")
    expect(toast.success).toHaveBeenCalledWith("Mensaje enviado.")
  })

  it("muestra error de carga inicial con botón de reintentar", async () => {
    mocks.getNotificationSettingsAction.mockResolvedValue({
      ok: true,
      data: buildData(),
    })

    renderComponent({ error: "No se pudo cargar." })

    expect(screen.getByText("No se pudo cargar.")).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    })

    expect(mocks.getNotificationSettingsAction).toHaveBeenCalled()
  })
})
