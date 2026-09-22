import { describe, expect, it } from "vitest"
import {
  authStatusLabel,
  canAuthenticate,
  isRegistrationStale,
  parseRegistrationApproval,
  parseRegistrationRejection,
  parseRegistrationRequest,
  parseRegistrationRequests,
  registrationExpiryClock,
  registrationRemaining,
} from "@/lib/registration"

const request = {
  requestId: "req-1",
  hostname: "pi-1",
  status: "PENDING" as const,
  createdAt: "2026-01-01T10:00:00.000Z",
  expiresAt: "2026-01-01T10:15:00.000Z",
}

describe("parseo de solicitudes de registro", () => {
  it("acepta una solicitud completa y omite deviceId si no está presente", () => {
    expect(parseRegistrationRequest(request)).toEqual(request)
    const assigned = { ...request, deviceId: "node-1" }
    expect(parseRegistrationRequest(assigned)).toEqual(assigned)
    expect(parseRegistrationRequest(request)?.deviceId).toBeUndefined()
  })

  it("rechaza solicitudes con estado, hostname, identificador o fechas inválidas", () => {
    expect(parseRegistrationRequest({ ...request, status: "cancelled" })).toBeNull()
    expect(parseRegistrationRequest({ ...request, requestId: "" })).toBeNull()
    expect(parseRegistrationRequest({ ...request, hostname: "" })).toBeNull()
    expect(parseRegistrationRequest({ ...request, expiresAt: "nope" })).toBeNull()
    expect(parseRegistrationRequest(null)).toBeNull()
  })

  it("valida el listado de forma atómica y distingue un envelope fallido", () => {
    expect(parseRegistrationRequests({ success: true, data: [request] })).toHaveLength(1)
    expect(parseRegistrationRequests({ success: true, data: [request, { estado: "x" }] })).toBeNull()
    expect(parseRegistrationRequests({ success: false, data: [request] })).toBeNull()
    expect(parseRegistrationRequests({ success: true, data: null })).toBeNull()
  })

  it("normaliza la aprobación en snake_case a camelCase", () => {
    expect(
      parseRegistrationApproval({ request_id: "req-1", status: "APPROVED", device_id: "node-1" }),
    ).toEqual({ requestId: "req-1", status: "APPROVED", deviceId: "node-1" })
    expect(
      parseRegistrationApproval({ request_id: "req-1", status: "APPROVED", device_id: "" }),
    ).toBeNull()
    expect(parseRegistrationApproval({ request_id: "req-1", status: "REJECTED", device_id: "n-1" })).toBeNull()
  })

  it("parsea el rechazo en camelCase", () => {
    expect(parseRegistrationRejection({ requestId: "req-1", status: "REJECTED" })).toEqual({
      requestId: "req-1",
      status: "REJECTED",
    })
    expect(parseRegistrationRejection({ requestId: "req-1", status: "APPROVED" })).toBeNull()
  })
})

describe("estado de credencial", () => {
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
    expect(registrationRemaining("2026-01-01T10:15:00.000Z", now).label).toBe("Vence en 15 min")
    expect(registrationRemaining("2026-01-01T10:00:30.000Z", now).label).toBe("Vence en menos de 1 min")
    expect(registrationRemaining("2026-01-01T12:00:00.000Z", now).label).toBe("Vence en 2 h")
  })

  it("marca como vencida una solicitud pasada o con fecha inválida", () => {
    expect(registrationRemaining("2026-01-01T09:59:00.000Z", now).expired).toBe(true)
    expect(registrationRemaining("2026-01-01T09:59:00.000Z", now).label).toBe("Vencida")
    expect(registrationRemaining("nope", now).expired).toBe(true)
  })

  it("detecta el tramo de urgencia antes del vencimiento", () => {
    expect(isRegistrationStale("2026-01-01T10:01:30.000Z", now)).toBe(true)
    expect(isRegistrationStale("2026-01-01T10:10:00.000Z", now)).toBe(false)
    expect(isRegistrationStale("2026-01-01T09:59:00.000Z", now)).toBe(false)
  })

  it("formatea el reloj de vencimiento en UTC", () => {
    expect(registrationExpiryClock("2026-01-01T10:15:00.000Z")).toBe("10:15")
  })
})
