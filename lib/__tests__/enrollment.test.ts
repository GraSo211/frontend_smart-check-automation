import { describe, expect, it } from "vitest"
import {
  authStatusLabel,
  canAuthenticate,
  enrollmentExpiryClock,
  enrollmentRemaining,
  isEnrollmentStale,
  lifecycleActionsFor,
  parseEnrollmentCancel,
  parseEnrollmentInvitation,
  parseEnrollmentInvitations,
  reprovisionConfirmation,
  revokeConfirmation,
} from "@/lib/enrollment"

const invitation = {
  enrollmentId: "enr-1",
  dispositivoId: null,
  nombre: "Nodo 1",
  ubicacion: "Línea A",
  whepUrl: "https://cam.test/whep",
  status: "pending" as const,
  code: "one-time-code",
  createdAt: "2026-01-01T10:00:00.000Z",
  expiresAt: "2026-01-01T10:15:00.000Z",
}

describe("parseo de invitaciones de enrolamiento", () => {
  it("acepta una invitación completa y conserva el código sólo si está presente", () => {
    expect(parseEnrollmentInvitation(invitation)).toEqual(invitation)
    const withoutCode = { ...invitation, code: undefined }
    expect(parseEnrollmentInvitation(withoutCode)?.code).toBeUndefined()
  })

  it("rechaza invitaciones con estado, fechas o identificador inválidos", () => {
    expect(parseEnrollmentInvitation({ ...invitation, status: "cancelled" })).toBeNull()
    expect(parseEnrollmentInvitation({ ...invitation, enrollmentId: "" })).toBeNull()
    expect(parseEnrollmentInvitation({ ...invitation, expiresAt: "nope" })).toBeNull()
    expect(parseEnrollmentInvitation(null)).toBeNull()
  })

  it("valida el listado de forma atómica y distingue un envelope fallido", () => {
    expect(parseEnrollmentInvitations({ success: true, data: [invitation] })).toHaveLength(1)
    expect(parseEnrollmentInvitations({ success: true, data: [invitation, { estado: "x" }] })).toBeNull()
    expect(parseEnrollmentInvitations({ success: false, data: [invitation] })).toBeNull()
    expect(parseEnrollmentInvitations({ success: true, data: null })).toBeNull()
  })

  it("parsea la respuesta de cancelación", () => {
    expect(parseEnrollmentCancel({ enrollmentId: "enr-1", status: "cancelled" })).toEqual({
      enrollmentId: "enr-1",
      status: "cancelled",
    })
    expect(parseEnrollmentCancel({ enrollmentId: "enr-1", status: "pending" })).toBeNull()
  })
})

describe("acciones de ciclo de vida por estado de credencial", () => {
  it("ofrece sólo transiciones válidas y siempre permite reprovisionar", () => {
    expect(lifecycleActionsFor("active")).toEqual(["disable", "revoke", "reprovision"])
    expect(lifecycleActionsFor("disabled")).toEqual(["enable", "revoke", "reprovision"])
    expect(lifecycleActionsFor("revoked")).toEqual(["reprovision"])
  })

  it("no ofrece acciones que el backend rechaza con 409 para un nodo sin enrolar", () => {
    // disable/enable/revoke son inválidos para `unenrolled`; reprovision sí es válido.
    expect(lifecycleActionsFor("unenrolled")).toEqual(["reprovision"])
    for (const action of ["disable", "enable", "revoke"] as const) {
      expect(lifecycleActionsFor("unenrolled")).not.toContain(action)
    }
  })

  it("considera que sólo una credencial activa puede autenticarse", () => {
    expect(canAuthenticate({ authStatus: "active" })).toBe(true)
    expect(canAuthenticate({ authStatus: "disabled" })).toBe(false)
    expect(canAuthenticate({})).toBe(false)
  })

  it("etiqueta el estado de credencial, con heredado por defecto", () => {
    expect(authStatusLabel("revoked")).toBe("Revocado")
    expect(authStatusLabel(undefined)).toBe("Sin enrolar")
  })
})

describe("cuenta regresiva de vencimiento", () => {
  const now = Date.parse("2026-01-01T10:00:00.000Z")

  it("describe el tiempo restante en minutos y horas", () => {
    expect(enrollmentRemaining("2026-01-01T10:15:00.000Z", now).label).toBe("Vence en 15 min")
    expect(enrollmentRemaining("2026-01-01T10:00:30.000Z", now).label).toBe("Vence en menos de 1 min")
    expect(enrollmentRemaining("2026-01-01T12:00:00.000Z", now).label).toBe("Vence en 2 h")
  })

  it("marca como vencida una invitación pasada o con fecha inválida", () => {
    expect(enrollmentRemaining("2026-01-01T09:59:00.000Z", now).expired).toBe(true)
    expect(enrollmentRemaining("nope", now).expired).toBe(true)
  })

  it("detecta el tramo de urgencia antes del vencimiento", () => {
    expect(isEnrollmentStale("2026-01-01T10:01:30.000Z", now)).toBe(true)
    expect(isEnrollmentStale("2026-01-01T10:10:00.000Z", now)).toBe(false)
    expect(isEnrollmentStale("2026-01-01T09:59:00.000Z", now)).toBe(false)
  })

  it("formatea el reloj de vencimiento en UTC", () => {
    expect(enrollmentExpiryClock("2026-01-01T10:15:00.000Z")).toBe("10:15")
  })
})

describe("confirmaciones de acciones destructivas", () => {
  it("explica la invalidación inmediata al revocar", () => {
    const copy = revokeConfirmation("Nodo 1")
    expect(copy.title).toContain("Revocar")
    expect(copy.description).toContain("Nodo 1")
    expect(copy.description).toContain("invalidada de inmediato")
    expect(copy.confirm).toBe("Revocar credencial")
  })

  it("explica la invalidación de la credencial anterior al reprovisionar", () => {
    const copy = reprovisionConfirmation("Nodo 1")
    expect(copy.title).toContain("Reprovisionar")
    expect(copy.description).toContain("credencial anterior")
    expect(copy.description).toContain("una sola vez")
    expect(copy.confirm).toBe("Generar código nuevo")
  })
})
