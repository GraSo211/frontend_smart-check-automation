import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/api-client"

const cookiesMock = vi.hoisted(() =>
  vi.fn(async () => ({
    get: vi.fn(() => ({ value: "jwt-token" })),
  })),
)
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, statusText: status === 200 ? "OK" : "Error" })
}

describe("server actions de datos del backend", () => {
  let api: typeof import("../api")
  const fetchMock = vi.fn()
  const validMetric = {
    id: "",
    dispositivoId: "node-1",
    cpuPct: 1,
    memRamDisponibleMb: 2,
    tempChip: 3,
    aiProcessorPct: 4,
    receivedAt: "2026-01-01T10:00:00.000Z",
  }
  const validDevice = {
    dispositivoId: "node-1",
    nombre: "Dispositivo 1",
    sectorId: "s-1",
    estado: "online",
    ultimaMetrica: validMetric,
    lastSeen: "2026-01-01T10:00:00.000Z",
  }
  const validDeviceRead = {
    ...validDevice,
    authStatus: "active",
    hasSecret: true,
    authUpdatedAt: "2026-01-01T09:00:00.000Z",
  }
  const validLote = {
    id: "l-1",
    sector_id: "s-1",
    estado: "ABIERTO",
    producto_id: "p-1",
    producto_nombre: "Tostada",
    abierto_en: "2026-01-01T10:00:00.000Z",
    abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
    conteos: { ok: 9, crudo: null, quemado: 1, total: 10 },
    confianza_promedio: null,
    ultimo_evento_en: "2026-01-01T10:05:00.000Z",
    inactividad_segundos: 12.5,
  }
  const sector = { id: "s-1", nombre: "Horno 1" }
  const validProducto = {
    id: "prod-1",
    nombre: "Producto real",
    activo: true,
    pesoReferenciaKg: 1,
    toleranciaPesoPct: 1,
    dimensionBaseCm: 1,
    toleranciaDimensionCm: 1,
    tempMin: 1,
    tempMax: 2,
    velocidadCintaMin: 1,
    velocidadCintaMax: 2,
    capacidadNominalKgH: null,
  }
  const validProductoRequest = {
    nombre: "Producto real",
    pesoReferenciaKg: 1,
    toleranciaPesoPct: 1,
    dimensionBaseCm: 1,
    toleranciaDimensionCm: 1,
    tempMin: 180,
    tempMax: 220,
    velocidadCintaMin: 0.5,
    velocidadCintaMax: 1.5,
  }
  const registrationRequest = {
    requestId: "req-1",
    hostname: "pi-1",
    status: "PENDING",
    createdAt: "2026-01-01T10:00:00.000Z",
    expiresAt: "2026-01-01T10:15:00.000Z",
  }

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test/"
    vi.stubGlobal("fetch", fetchMock)
    api = await import("../api")
  })

  beforeEach(() => {
    fetchMock.mockReset()
    revalidatePathMock.mockReset()
  })

  it.each([
    ["getDevices", () => api.getDevices(), "GET", { success: true, data: [] }],
    ["getRegistrationRequests", () => api.getRegistrationRequests(), "GET", { success: true, data: [] }],
    ["getSectores", () => api.getSectores(), "GET", { success: true, data: [] }],
    ["getLotes", () => api.getLotes("s-1"), "GET", { success: true, data: [] }],
    ["getLoteAbierto", () => api.getLoteAbierto("s-1"), "GET", { success: true, data: { lote: null } }],
    ["updateDispositivo", () => api.updateDispositivo({ dispositivoId: "node-1", sectorId: "s-1" }), "PUT", { success: true, data: validDeviceRead }],
    ["createSector", () => api.createSector({ nombre: "Horno 1" }), "POST", { success: true, data: sector }],
    ["updateSector", () => api.updateSector({ id: "s-1", nombre: "Horno 1" }), "PUT", { success: true, data: sector }],
    ["deleteSector", () => api.deleteSector("s-1"), "DELETE", { success: true, data: null }],
    ["approveRegistrationRequest", () => api.approveRegistrationRequest("req-1"), "POST", { success: true, data: { request_id: "req-1", status: "APPROVED", device_id: "node-1" } }],
    ["rejectRegistrationRequest", () => api.rejectRegistrationRequest("req-1"), "POST", { success: true, data: { requestId: "req-1", status: "REJECTED" } }],
  ])("reenvía la cookie de sesión para %s", async (_name, action, method, body) => {
    fetchMock.mockResolvedValue(json(body))

    await action()

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method ?? "GET").toBe(method)
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      Cookie: "session_token=jwt-token",
    })
    expect(options.credentials).toBeUndefined()
  })

  it("parsea los campos de seguridad del catálogo de dispositivos", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [validDeviceRead] }))

    await expect(api.getDevices()).resolves.toEqual([validDeviceRead])
  })

  it("mapea un código de error del backend a un mensaje en español", async () => {
    fetchMock.mockResolvedValue(json({
      success: false,
      message: "El dispositivo no existe",
      errors: { code: "device_not_found" },
    }, 404))

    await expect(api.approveRegistrationRequest("req-1")).resolves.toEqual({
      ok: false,
      errors: ["El dispositivo no existe."],
      code: "device_not_found",
    })
  })

  it.each([
    [404, "La solicitud de registro no existe."],
    [409, "La solicitud de registro ya fue resuelta."],
    [410, "La solicitud de registro expiró."],
  ])("traduce el estado HTTP %i de una solicitud de registro", async (status, message) => {
    fetchMock.mockResolvedValue(json({ success: false, message: "", errors: null }, status))

    await expect(api.rejectRegistrationRequest("req-1")).resolves.toEqual({
      ok: false,
      errors: [message],
    })
  })

  it("acepta métricas live con id vacío en la respuesta de dispositivos", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [validDevice] }))

    await expect(api.getDevices()).resolves.toEqual([validDevice])
  })

  it("rechaza atómicamente una fila de dispositivos con telemetría numérica inválida", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: [validDevice, { ...validDevice, dispositivoId: "node-2", ultimaMetrica: { ...validMetric, cpuPct: "bad" } }],
    }))

    await expect(api.getDevices()).rejects.toThrow("respuesta inválida para dispositivos")
  })

  it("expone el historial de dispositivo con metadatos y URL de página", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: [],
      total: 41,
      page: 2,
      pageSize: 20,
    }))

    await expect(api.getDeviceHistoryPage("node/1", 2, 20)).resolves.toEqual({
      items: [], total: 41, page: 2, pageSize: 20,
    })
    expect(fetchMock.mock.calls[0][0]).toContain("dispositivoId=node%2F1&page=2&pageSize=20")
  })

  it.each([
    ["getDevices", () => api.getDevices(), "https://backend.example.test/api/v1/dispositivos"],
    ["getProductos", () => api.getProductos(), "https://backend.example.test/api/v1/productos"],
  ])("obtiene datos reales y conserva la URL de paginación para %s", async (_name, action, expectedUrl) => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    const result = await action()

    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_token=jwt-token",
      },
    }))
    expect(result).toEqual([])
  })

  it("conserva un resultado vacío válido en getProductos", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    await expect(api.getProductos()).resolves.toEqual([])
  })

  it("conserva las formas de éxito de productos", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [validProducto] }))
    await expect(api.getProductos()).resolves.toEqual([validProducto])
  })

  it("normaliza a null la capacidad nominal ausente en respuestas viejas", async () => {
    const legacyProducto: Record<string, unknown> = { ...validProducto }
    delete legacyProducto.capacidadNominalKgH
    fetchMock.mockResolvedValue(json({ success: true, data: [legacyProducto] }))
    await expect(api.getProductos()).resolves.toEqual([{ ...legacyProducto, capacidadNominalKgH: null }])
  })

  it("rechaza un producto con forma inválida en getProductos", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [{ id: "prod-1", nombre: "Producto real" }] }))
    await expect(api.getProductos()).rejects.toThrow("respuesta inválida para productos")
  })

  it("expone fieldErrors y mensajes cuando createProducto recibe un 422 por campo", async () => {
    fetchMock.mockResolvedValue(json({
      success: false,
      message: "Datos de producto inválidos",
      data: null,
      errors: {
        nombre: "es requerido",
        pesoReferenciaKg: "debe ser un valor numérico mayor a 0",
        tempSetpoint: "debe estar entre tempMin y tempMax",
      },
    }, 422))

    const result = await api.createProducto(validProductoRequest)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("se esperaba un resultado de error")
    expect(result.fieldErrors).toEqual({
      nombre: "es requerido",
      pesoReferenciaKg: "debe ser un valor numérico mayor a 0",
      tempSetpoint: "debe estar entre tempMin y tempMax",
    })
    expect(result.errors).toEqual([
      "es requerido",
      "debe ser un valor numérico mayor a 0",
      "debe estar entre tempMin y tempMax",
    ])
    expect(fetchMock.mock.calls[0][1].method).toBe("POST")
  })

  it("distingue un 422 con errors string (body malformado) del mapa por campo", async () => {
    fetchMock.mockResolvedValue(json({
      success: false,
      message: "Datos de producto inválidos",
      data: null,
      errors: "unexpected end of JSON input",
    }, 422))

    const result = await api.createProducto(validProductoRequest)

    expect(result).toEqual({
      ok: false,
      errors: ["unexpected end of JSON input"],
    })
  })

  it("conserva el 404 de updateProducto como producto inexistente", async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

    await expect(api.updateProducto("prod/1", validProductoRequest)).resolves.toEqual({
      ok: false,
      errors: ["El producto no existe"],
    })
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/productos/prod%2F1")
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT")
  })

  it.each([
    ["getProductos", () => api.getProductos()],
  ])("propaga un error HTTP en %s", async (_name, action) => {
    fetchMock.mockResolvedValue(json("error", 500))

    await expect(action()).rejects.toThrow("La API respondió con 500")
  })

  it.each([
    ["getProductos", () => api.getProductos()],
  ])("usa ApiError para una sesión no autorizada en %s", async (_name, action) => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }))

    const promise = action()
    await expect(promise).rejects.toMatchObject({
      status: 401,
      name: "ApiError",
    })
    await expect(promise).rejects.toBeInstanceOf(ApiError)
  })

  it.each([
    ["getProductos", () => api.getProductos()],
  ])("propaga errores de red en %s", async (_name, action) => {
    fetchMock.mockRejectedValue(new Error("network failure"))

    await expect(action()).rejects.toThrow("network failure")
  })

  it.each([
    ["getSectores", () => api.getSectores()],
    ["getLotes", () => api.getLotes("s-1")],
    ["getLoteAbierto", () => api.getLoteAbierto("s-1")],
    ["getProductos", () => api.getProductos()],
  ])("propaga timeout sin datos de respaldo en %s", async (_name, action) => {
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

    const promise = action()
    const rejection = promise.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(8000)
    const error = await rejection
    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw error
    expect(error.message).toContain("no respondió a tiempo")
    vi.useRealTimers()
  })

  it.each([
    ["getSectores", (module: typeof import("../api")) => module.getSectores()],
    ["getLotes", (module: typeof import("../api")) => module.getLotes("s-1")],
    ["getProductos", (module: typeof import("../api")) => module.getProductos()],
  ])("falla explícitamente si falta NEXT_PUBLIC_API_URL en %s", async (_name, action) => {
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    delete process.env.NEXT_PUBLIC_API_URL
    vi.resetModules()
    const moduleWithoutUrl = await import("../api")

    await expect(action(moduleWithoutUrl)).rejects.toThrow("NEXT_PUBLIC_API_URL no está definida")

    process.env.NEXT_PUBLIC_API_URL = previousUrl
  })

  it.each([
    ["getSectores", () => api.getSectores(), { success: true, data: null }, "respuesta inválida para sectores"],
    ["getLotes", () => api.getLotes("s-1"), { success: true, data: null }, "respuesta inválida para el historial de lotes"],
    ["getLoteAbierto", () => api.getLoteAbierto("s-1"), { success: true, data: null }, "respuesta inválida para el lote abierto"],
    ["getProductos", () => api.getProductos(), { success: true, data: { not: "an array" } }, "respuesta inválida"],
    ["getDevices", () => api.getDevices(), { success: true, data: null }, "respuesta inválida"],
  ])("rechaza una respuesta malformada en %s en vez de convertirla en vacío", async (_name, action, body, message) => {
    fetchMock.mockResolvedValue(json(body))

    await expect(action()).rejects.toThrow(message)
  })

  it("no construye una URL con slash final", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    await api.getDevices()

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/dispositivos")
  })

  it("lee las solicitudes de registro y valida el envelope", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      message: "ok",
      data: [registrationRequest],
    }))

    await expect(api.getRegistrationRequests()).resolves.toEqual([registrationRequest])
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/registration-requests")
  })

  it("rechaza un envelope de solicitudes de registro malformado", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: [{ requestId: "req-1", status: "PENDING", createdAt: "bad", expiresAt: "bad" }],
    }))

    await expect(api.getRegistrationRequests()).rejects.toThrow("respuesta inválida para las solicitudes de registro")
  })

  it("normaliza la aprobación en snake_case y codifica la ruta", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: { request_id: "req/1", status: "APPROVED", device_id: "node-1" },
    }))

    const result = await api.approveRegistrationRequest("req/1")
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/registration-requests/req%2F1/approve")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({})
    expect(result).toEqual({
      ok: true,
      data: { requestId: "req/1", status: "APPROVED", deviceId: "node-1" },
    })
  })

  it("codifica los identificadores en la ruta de rechazo", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: { requestId: "req/1", status: "REJECTED" },
    }))

    const result = await api.rejectRegistrationRequest("req/1")
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/registration-requests/req%2F1/reject")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({})
    expect(result).toEqual({ ok: true, data: { requestId: "req/1", status: "REJECTED" } })
  })

  it("envía sólo dispositivoId y sectorId al actualizar", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: { ...validDeviceRead },
    }))

    const result = await api.updateDispositivo({
      dispositivoId: "node-1",
      sectorId: "s-1",
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      dispositivoId: "node-1",
      sectorId: "s-1",
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ dispositivoId: "node-1", sectorId: "s-1" }),
    })
  })

  it("permite desasignar el sector enviando sectorId null", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { ...validDevice, sectorId: undefined } }))

    await api.updateDispositivo({ dispositivoId: "node-1", sectorId: null })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      dispositivoId: "node-1",
      sectorId: null,
    })
  })

  it("traduce el 409 de updateDispositivo a un mensaje de conflicto de rol", async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: "" }, 409))

    await expect(api.updateDispositivo({ dispositivoId: "node-1", sectorId: "s-1" })).resolves.toEqual({
      ok: false,
      errors: ["El sector ya tiene un dispositivo con ese rol (entrada o salida)."],
    })
  })

  it("renombra un dispositivo desde el panel y codifica el id en la ruta", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: { ...validDeviceRead, nombre: "Pi Renombrada" },
    }))

    const result = await api.renameDispositivo("node/1", "  Pi Renombrada  ")

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/dispositivos/node%2F1/nombre")
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ nombre: "Pi Renombrada" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dispositivos")
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ nombre: "Pi Renombrada" }),
    })
  })

  it("rechaza el rename si el nombre está vacío sin pegarle al backend", async () => {
    const result = await api.renameDispositivo("node-1", "   ")

    expect(result).toEqual({ ok: false, errors: ["El nombre es requerido."] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("traduce el 404 de renameDispositivo a un mensaje claro", async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

    await expect(api.renameDispositivo("node-1", "Pi Renombrada")).resolves.toEqual({
      ok: false,
      errors: ["El dispositivo no existe."],
    })
  })

  // ─── Catálogo de sectores ──────────────────────────────────────────────────

  it("crea un sector y revalida las vistas del catálogo", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: sector }, 201))

    const result = await api.createSector({ nombre: "Horno 1" })

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/sectores")
    expect(fetchMock.mock.calls[0][1].method).toBe("POST")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ nombre: "Horno 1" })
    expect(result).toEqual({ ok: true, data: sector })
    expect(revalidatePathMock).toHaveBeenCalledWith("/sectores")
    expect(revalidatePathMock).toHaveBeenCalledWith("/configuracion")
  })

  it("actualiza un sector y codifica el id en la ruta", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { id: "s/1", nombre: "Horno Sur" } }))

    const result = await api.updateSector({ id: "s/1", nombre: "Horno Sur" })

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/sectores/s%2F1")
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ nombre: "Horno Sur" })
    expect(result).toEqual({ ok: true, data: { id: "s/1", nombre: "Horno Sur" } })
  })

  it("elimina un sector sin enviar body", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: null }))

    const result = await api.deleteSector("s/1")

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/sectores/s%2F1")
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
    expect(result).toEqual({ ok: true, data: null })
    expect(revalidatePathMock).toHaveBeenCalledWith("/sectores")
  })

  it("traduce el 409 de deleteSector a un mensaje de lotes asociados", async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: "" }, 409))

    await expect(api.deleteSector("s-1")).resolves.toEqual({
      ok: false,
      errors: ["El sector tiene lotes asociados y no se puede eliminar."],
    })
  })

  it("rechaza un sector inválido al crear", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { id: "", nombre: "Horno 1" } }, 201))

    await expect(api.createSector({ nombre: "Horno 1" })).resolves.toEqual({
      ok: false,
      errors: ["La API devolvió un sector inválido."],
    })
  })

  // ─── Sector / lotes ────────────────────────────────────────────────────────

  it("obtiene los sectores y valida la forma de cada fila", async () => {
    fetchMock.mockResolvedValue(json({ success: true, message: "ok", data: [sector] }))

    await expect(api.getSectores()).resolves.toEqual([sector])
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/sectores")
  })

  it("rechaza sectores con filas inválidas", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [{ id: "", nombre: "Horno 1" }] }))

    await expect(api.getSectores()).rejects.toThrow("respuesta inválida para sectores")
  })

  it("construye la URL de lotes con URLSearchParams y expone el cursor", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: [validLote],
      total: 41,
      page: 1,
      pageSize: 100,
      siguiente_cursor: "cursor/2",
    }))

    const result = await api.getLotes("sector/1", { productoId: "product/1", limite: 100, antesDe: "cursor/1" })

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://backend.example.test/api/v1/lotes?sector_id=sector%2F1&producto_id=product%2F1&limite=100&antes_de=cursor%2F1",
    )
    expect(result).toEqual({ items: [validLote], total: 41, siguienteCursor: "cursor/2" })
  })

  it("aplica el límite por defecto y el tope de 100 en lotes", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    await api.getLotes("s-1")
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/lotes?sector_id=s-1&limite=20")

    fetchMock.mockClear()
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))
    await api.getLotes("s-1", { limite: 5000 })
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/lotes?sector_id=s-1&limite=100")
  })

  it("conserva una lista vacía válida de lotes y usa items.length si falta total", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    await expect(api.getLotes("s-1")).resolves.toEqual({ items: [], total: 0, siguienteCursor: null })
  })

  it("omite siguiente_cursor cuando el backend no lo envía", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [validLote], total: 1, page: 1, pageSize: 20 }))

    const result = await api.getLotes("s-1")
    expect(result.siguienteCursor).toBeNull()
  })

  it("usa ApiError 401 en getSectores, getLotes y getLoteAbierto", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }))
    for (const action of [api.getSectores(), api.getLotes("s-1"), api.getLoteAbierto("s-1")]) {
      await expect(action).rejects.toBeInstanceOf(ApiError)
      await expect(action).rejects.toMatchObject({ status: 401 })
    }
  })

  it("devuelve null cuando no hay lote abierto", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: null } }))

    await expect(api.getLoteAbierto("s-1")).resolves.toBeNull()
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/lotes/abierto?sector_id=s-1")
  })

  it("parsea el lote abierto cuando está presente", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: validLote } }))

    await expect(api.getLoteAbierto("s-1")).resolves.toEqual(validLote)
  })

  it("rechaza un lote abierto presente pero inválido", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: { id: "bad" } } }))

    await expect(api.getLoteAbierto("s-1")).rejects.toThrow("respuesta inválida para el lote abierto")
  })

  it("parsea los campos delta opcionales de un lote", async () => {
    const loteConDeltas = {
      ...validLote,
      delta_temp1_max_c: 10,
      delta_vel_max: 0.05,
    }
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: loteConDeltas } }))

    await expect(api.getLoteAbierto("s-1")).resolves.toEqual(loteConDeltas)
  })

  it("normaliza valores delta inválidos a null sin rechazar la fila", async () => {
    const loteConDeltasInvalidos = {
      ...validLote,
      delta_temp1_max_c: "malo",
      delta_vel_max: {},
    }
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: loteConDeltasInvalidos } }))

    const result = await api.getLoteAbierto("s-1")
    expect(result).toEqual({ ...validLote, delta_temp1_max_c: null, delta_vel_max: null })
  })

  it("parsea confianza_promedio en [0,1] y normaliza el resto a null", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: { ...validLote, confianza_promedio: 0.873 } } }))
    await expect(api.getLoteAbierto("s-1")).resolves.toMatchObject({ confianza_promedio: 0.873 })

    fetchMock.mockResolvedValue(json({ success: true, data: { lote: { ...validLote, confianza_promedio: 1.2 } } }))
    await expect(api.getLoteAbierto("s-1")).resolves.toMatchObject({ confianza_promedio: null })

    fetchMock.mockResolvedValue(json({ success: true, data: { lote: { ...validLote, confianza_promedio: "alta" } } }))
    await expect(api.getLoteAbierto("s-1")).resolves.toMatchObject({ confianza_promedio: null })
  })

  it("getAllLotes itera los sectores y sigue el cursor de cada uno", async () => {
    const loteFor = (id: string, sectorId: string) => ({ ...validLote, id, sector_id: sectorId })
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith("/sectores")) {
        return json({ success: true, data: [sector, { id: "s-2", nombre: "Horno Norte" }] })
      }
      const sectorId = parsed.searchParams.get("sector_id")
      const antesDe = parsed.searchParams.get("antes_de")
      if (sectorId === "s-1") {
        return antesDe
          ? json({ success: true, data: [loteFor("s1-b", "s-1")], total: 2, page: 1, pageSize: 100 })
          : json({ success: true, data: [loteFor("s1-a", "s-1")], total: 2, page: 1, pageSize: 100, siguiente_cursor: "s1-cursor" })
      }
      return json({ success: true, data: [loteFor("s2-a", "s-2")], total: 1, page: 1, pageSize: 100 })
    })

    const lotes = await api.getAllLotes()

    expect(lotes.map((item) => item.id).sort()).toEqual(["s1-a", "s1-b", "s2-a"])
    // 1 sectores + 2 páginas de s-1 + 1 de s-2 (los sectores se recorren en paralelo)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("antes_de=s1-cursor"))).toBe(true)
  })

  it("getAllLotes deduplica por id los lotes repetidos entre sectores", async () => {
    const loteFor = (id: string, sectorId: string) => ({ ...validLote, id, sector_id: sectorId })
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith("/sectores")) {
        return json({ success: true, data: [sector, { id: "s-2", nombre: "Horno Norte" }] })
      }
      const sectorId = parsed.searchParams.get("sector_id") ?? "s-1"
      return json({ success: true, data: [loteFor("repetido", sectorId), loteFor(`unico-${sectorId}`, sectorId)], total: 2, page: 1, pageSize: 100 })
    })

    const lotes = await api.getAllLotes()

    expect(lotes.map((item) => item.id).sort()).toEqual(["repetido", "unico-s-1", "unico-s-2"])
  })

  it("getAllLotes es atómico: si falla un sector no publica una colección parcial", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith("/sectores")) {
        return json({ success: true, data: [sector, { id: "s-2", nombre: "Horno Norte" }] })
      }
      if (parsed.searchParams.get("sector_id") === "s-1") {
        return json({ success: true, data: [validLote], total: 1, page: 1, pageSize: 100 })
      }
      return json({ success: false, message: "boom" }, 500)
    })

    await expect(api.getAllLotes()).rejects.toThrow("Los lotes no están disponibles.")
  })

  it("getAllLotes preserva un ApiError de sesión en vez de enmascararlo", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith("/sectores")) {
        return json({ success: true, data: [sector] })
      }
      return new Response("", { status: 401 })
    })

    const promise = api.getAllLotes()
    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ status: 401 })
  })

  it("getAllLotes preserva el mensaje de timeout en vez de usar el genérico", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((url: string, options: RequestInit) => {
      if (String(url).includes("/sectores")) {
        return Promise.resolve(json({ success: true, data: [sector] }))
      }
      return new Promise((_, reject) => {
        options.signal?.addEventListener("abort", () => {
          const error = new Error("aborted")
          error.name = "AbortError"
          reject(error)
        })
      })
    })

    const promise = api.getAllLotes()
    const rejection = promise.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(8000)
    const error = await rejection
    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw error
    expect(error.message).toContain("no respondió a tiempo")
    expect(error.message).not.toBe("Los lotes no están disponibles.")
    vi.useRealTimers()
  })

  it("acepta un lote abierto con abierto_por.type vacío (lote degradado)", async () => {
    const degraded = { ...validLote, abierto_por: { device_id: "d-1", type: "" } }
    fetchMock.mockResolvedValue(json({ success: true, data: { lote: degraded } }))

    await expect(api.getLoteAbierto("s-1")).resolves.toEqual(degraded)
  })

  describe("getControlEstado (GET /api/v1/lotes/{id}/control/estado)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("parsea un estado con loop activo", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            loop_activo: true,
            modo: "AUTOMATICO",
            started_at: "2026-09-23T09:00:00.000Z",
          },
        }),
      )

      await expect(api.getControlEstado("l-1")).resolves.toEqual({
        loop_activo: true,
        modo: "AUTOMATICO",
        started_at: "2026-09-23T09:00:00.000Z",
      })
    })

    it("normaliza un modo desconocido a MANUAL (forward compat)", async () => {
      fetchMock.mockResolvedValue(
        json({ success: true, data: { loop_activo: false, modo: "DESCONOCIDO" } }),
      )

      await expect(api.getControlEstado("l-1")).resolves.toEqual({
        loop_activo: false,
        modo: "MANUAL",
        started_at: null,
      })
    })

    it("devuelve null cuando el endpoint responde 404 (aún no implementado en el backend)", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

      await expect(api.getControlEstado("l-1")).resolves.toBeNull()
    })

    it("devuelve null cuando la respuesta no tiene la forma esperada", async () => {
      fetchMock.mockResolvedValue(json({ success: true }))

      await expect(api.getControlEstado("l-1")).resolves.toBeNull()
    })

    it("silencia timeouts: no rompe la página si el endpoint está frío", async () => {
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

      const promise = api.getControlEstado("l-1")
      await vi.advanceTimersByTimeAsync(8000)
      await expect(promise).resolves.toBeNull()
      vi.useRealTimers()
    })
  })

  describe("getAlertas (GET /api/v1/alertas)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("parsea la lista y normaliza estado/severidad desconocidos", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: [
            {
              id: "a-1",
              sector_id: "s-1",
              lote_id: "l-1",
              tipo: "umbral_quemado",
              severidad: "CRITICAL",
              estado: "ACTIVA",
              mensaje: "Tasa de quemados supera el 5%",
              created_at: "2026-09-23T08:00:00.000Z",
            },
            {
              id: "a-2",
              tipo: "nodo_offline",
              severidad: "BOGUS",
              estado: "DESCONOCIDO",
              mensaje: "Raspberry sin heartbeat",
              created_at: "2026-09-23T08:05:00.000Z",
              acked_por: { email: "sup@fermar.com", nombre: "Supervisor" },
              acked_at: "2026-09-23T08:10:00.000Z",
            },
          ],
        }),
      )

      await expect(api.getAlertas()).resolves.toEqual([
        {
          id: "a-1",
          sector_id: "s-1",
          lote_id: "l-1",
          tipo: "umbral_quemado",
          severidad: "CRITICAL",
          estado: "ACTIVA",
          mensaje: "Tasa de quemados supera el 5%",
          created_at: "2026-09-23T08:00:00.000Z",
          acked_por: null,
          acked_at: null,
        },
        {
          id: "a-2",
          sector_id: null,
          lote_id: null,
          tipo: "nodo_offline",
          severidad: "INFO",
          estado: "ACTIVA",
          mensaje: "Raspberry sin heartbeat",
          created_at: "2026-09-23T08:05:00.000Z",
          acked_por: { email: "sup@fermar.com", nombre: "Supervisor" },
          acked_at: "2026-09-23T08:10:00.000Z",
        },
      ])
    })

    it("acepta el query param estado cuando se pasa un filtro", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: [] }))

      await api.getAlertas({ estado: "ACK" })

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe("https://backend.example.test/api/v1/alertas?estado=ACK")
    })

    it("tolerancia: 404 -> [] cuando el endpoint todavía no existe", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

      await expect(api.getAlertas()).resolves.toEqual([])
    })

    it("descarta filas inválidas (id vacío o created_at no ISO)", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: [
            {
              id: "a-ok",
              tipo: "t",
              severidad: "INFO",
              estado: "ACTIVA",
              mensaje: "ok",
              created_at: "2026-09-23T08:00:00.000Z",
            },
            { id: "", tipo: "t", severidad: "INFO", estado: "ACTIVA", mensaje: "x", created_at: "2026-09-23T08:00:00.000Z" },
            { id: "a-mal", tipo: "t", severidad: "INFO", estado: "ACTIVA", mensaje: "x", created_at: "no-fecha" },
          ],
        }),
      )

      await expect(api.getAlertas()).resolves.toHaveLength(1)
    })

    it("propaga el timeout cuando el fetch excede los 8s", async () => {
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

      const promise = api.getAlertas()
      const rejection = expect(promise).rejects.toThrow("no respondió a tiempo")
      await vi.advanceTimersByTimeAsync(8000)
      await rejection
      vi.useRealTimers()
    })

    it("propaga un 5xx en vez de degradar a []", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 503))

      await expect(api.getAlertas()).rejects.toThrow("La API respondió con 503")
    })
  })

  describe("ackAlerta (POST /api/v1/alertas/{id}/ack)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("hace POST con cookie-forward y revalida /alertas", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            id: "a-1",
            sector_id: "s-1",
            lote_id: "l-1",
            tipo: "umbral_quemado",
            severidad: "CRITICAL",
            estado: "ACK",
            mensaje: "Tasa de quemados supera el 5%",
            created_at: "2026-09-23T08:00:00.000Z",
            acked_por: { email: "sup@fermar.com", nombre: "Supervisor" },
            acked_at: "2026-09-23T08:15:00.000Z",
          },
        }),
      )

      const result = await api.ackAlerta("a-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.estado).toBe("ACK")
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe("https://backend.example.test/api/v1/alertas/a-1/ack")
      expect(options.method).toBe("POST")
      expect(options.headers).toMatchObject({ Cookie: "session_token=jwt-token" })
      expect(revalidatePathMock).toHaveBeenCalledWith("/alertas")
    })

    it("traduce 404 a «La alerta no existe.»", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

      const result = await api.ackAlerta("a-404")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toBe("La alerta no existe.")
    })

    it("traduce 409 a «La alerta ya fue reconocida o resuelta.»", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 409))

      const result = await api.ackAlerta("a-1")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toBe("La alerta ya fue reconocida o resuelta.")
    })
  })

describe("getConfianzaClases (GET /api/v1/lotes/{id}/confianza-clases)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("parsea la lista de clases con media, stddev y muestras", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            clases: [
              { clase: "OK", confianza_media: 0.92, confianza_stddev: 0.04, muestras: 154 },
              { clase: "QUEMADO", confianza_media: 0.71, confianza_stddev: 0.12, muestras: 22 },
            ],
          },
        }),
      )

      await expect(api.getConfianzaClases("l-1", 200)).resolves.toEqual([
        { clase: "OK", confianza_media: 0.92, confianza_stddev: 0.04, muestras: 154 },
        { clase: "QUEMADO", confianza_media: 0.71, confianza_stddev: 0.12, muestras: 22 },
      ])
    })

    it("usa 200 como límite por default y clampa el valor recibido", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: { clases: [] } }))

      await api.getConfianzaClases("l-1")

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe("https://backend.example.test/api/v1/lotes/l-1/confianza-clases?limite=200")
    })

    it("clampa el límite al rango [1, 2000]", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: { clases: [] } }))

      await api.getConfianzaClases("l-1", 99999)
      expect(fetchMock.mock.calls[0][0]).toContain("limite=2000")

      fetchMock.mockReset()
      fetchMock.mockResolvedValue(json({ success: true, data: { clases: [] } }))

      await api.getConfianzaClases("l-1", -3)
      expect(fetchMock.mock.calls[0][0]).toContain("limite=1")
    })

    it("tolerancia: devuelve [] cuando el endpoint responde 404 (aún no implementado)", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

      await expect(api.getConfianzaClases("l-1")).resolves.toEqual([])
    })

    it("descarta filas inválidas (clase vacía o media no numérica)", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            clases: [
              { clase: "OK", confianza_media: 0.9, muestras: 10 },
              { clase: "", confianza_media: 0.5, muestras: 5 },
              { clase: "QUEMADO", confianza_media: "nope", muestras: 1 },
              { clase: "CRUDO", confianza_media: 0.4 },
            ],
          },
        }),
      )

      await expect(api.getConfianzaClases("l-1")).resolves.toEqual([
        { clase: "OK", confianza_media: 0.9, confianza_stddev: null, muestras: 10 },
      ])
    })

    it("propaga el timeout cuando el fetch excede los 8s", async () => {
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

      const promise = api.getConfianzaClases("l-1")
      const rejection = expect(promise).rejects.toThrow("no respondió a tiempo")
      await vi.advanceTimersByTimeAsync(8000)
      await rejection
      vi.useRealTimers()
    })

    it("propaga un 5xx en vez de degradar a []", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 500))

      await expect(api.getConfianzaClases("l-1")).rejects.toThrow("La API respondió con 500")
    })
  })

  describe("getMetricasHorno (GET /api/v1/lotes/{id}/metricas-horno)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("tolerancia: devuelve [] cuando el lote responde 404", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 404))

      await expect(api.getMetricasHorno("l-1")).resolves.toEqual([])
    })

    it("propaga un 5xx en vez de degradar a []", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 502))

      await expect(api.getMetricasHorno("l-1")).rejects.toThrow("La API respondió con 502")
    })
  })

describe("cambiarModo (PATCH /api/v1/lotes/{id}/modo)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("hace PATCH con body JSON y reenvía la cookie de sesión", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: { lote_id: "l-1", modo: "SUPERVISION" } }))

      const result = await api.cambiarModo("l-1", "SUPERVISION")

      expect(result).toEqual({ ok: true, data: { lote_id: "l-1", modo: "SUPERVISION" } })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe("https://backend.example.test/api/v1/lotes/l-1/modo")
      expect(options.method).toBe("PATCH")
      expect(options.headers).toMatchObject({
        "Content-Type": "application/json",
        Cookie: "session_token=jwt-token",
      })
      expect(options.body).toBe(JSON.stringify({ modo: "SUPERVISION" }))
      expect(options.cache).toBe("no-store")
    })

    it("revalida /lotes y la ruta detalle del lote en éxito", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: { lote_id: "l-1", modo: "MANUAL" } }))

      await api.cambiarModo("l-1", "MANUAL")

      expect(revalidatePathMock).toHaveBeenCalledWith("/lotes")
      expect(revalidatePathMock).toHaveBeenCalledWith("/lotes/l-1/control")
    })

    it("traduce 409 a un mensaje claro en español", async () => {
      fetchMock.mockResolvedValue(json({
        success: false,
        message: "Conflicto",
        errors: { code: "loop_active" },
      }, 409))

      const result = await api.cambiarModo("l-1", "MANUAL")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toContain("Conflicto al cambiar el modo")
      expect(result.errors[0]).toContain("loop activo")
    })

    it("traduce 404 a un mensaje claro en español", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "", errors: null }, 404))

      const result = await api.cambiarModo("l-1", "SUPERVISION")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toBe("El lote no existe.")
    })

    it("preserva el modo del servidor aunque difiera del solicitado", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: { lote_id: "l-1", modo: "AUTOMATICO" } }))

      const result = await api.cambiarModo("l-1", "MANUAL")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.modo).toBe("AUTOMATICO")
    })

    it("devuelve el modo solicitado si el backend no incluye uno en la respuesta", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: null }))

      const result = await api.cambiarModo("l-1", "SUPERVISION")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual({ lote_id: "l-1", modo: "SUPERVISION" })
    })

    it("traduce el timeout (8s) a un mensaje claro en español", async () => {
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

      const promise = api.cambiarModo("l-1", "AUTOMATICO")
      await vi.advanceTimersByTimeAsync(8000)
      const result = await promise
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toContain("no respondió a tiempo")
      vi.useRealTimers()
    })
  })

  describe("updateControlParams (PATCH /api/v1/lotes/{id}/control/parametros)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("hace PATCH con sólo los campos enviados y revalida /lotes", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            lote_id: "l-1",
            tolerancia_temp_c: 3,
            delta_temp1_max_c: 4,
          },
        }),
      )

      const result = await api.updateControlParams("l-1", {
        tolerancia_temp_c: 3,
        delta_temp1_max_c: 4,
      })

      expect(result).toEqual({
        ok: true,
        data: { lote_id: "l-1", tolerancia_temp_c: 3, delta_temp1_max_c: 4 },
      })
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://backend.example.test/api/v1/lotes/l-1/control/parametros",
      )
      expect(fetchMock.mock.calls[0][1].method).toBe("PATCH")
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
        tolerancia_temp_c: 3,
        delta_temp1_max_c: 4,
      })
      expect(revalidatePathMock).toHaveBeenCalledWith("/lotes")
    })

    it.each([
      [400, "Revisá los valores ingresados: están fuera de rango o faltan."],
      [403, "Se requiere rol Supervisor o Administrador."],
      [404, "El lote no existe."],
      [409, "El lote no está abierto o no admite cambios de parámetros."],
    ])("traduce el estado HTTP %i a un mensaje claro", async (status, message) => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, status))

      const result = await api.updateControlParams("l-1", { tolerancia_temp_c: 3 })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors[0]).toBe(message)
    })
  })

  describe("getConsignaPropuesta (GET /api/v1/lotes/{id}/consigna-propuesta)", () => {
    beforeEach(() => {
      fetchMock.mockReset()
      revalidatePathMock.mockReset()
    })

    it("parsea la forma directa actual (data contiene la propuesta)", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            decision_id: "dec-1",
            temp1_objetivo: 180.5,
            vel_objetivo: 1.25,
            generated_at: "2026-09-23T08:00:00.000Z",
            ttl_segundos: 60,
            ventana_inicio: "2026-09-23T07:55:00.000Z",
            ventana_fin: "2026-09-23T08:00:00.000Z",
            autorizada: false,
            fase: "supervision",
          },
        }),
      )

      await expect(api.getConsignaPropuesta("l-1")).resolves.toEqual({
        temp1: 180.5,
        velocidad: 1.25,
        z: 0,
        prediccion: null,
        ventana_inicio: "2026-09-23T07:55:00.000Z",
        ventana_fin: "2026-09-23T08:00:00.000Z",
        autorizada: false,
        fase: "supervision",
        decision_id: "dec-1",
        limites: null,
      })
    })

    it("soporta la forma anidada legacy (data.propuesta)", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            propuesta: {
              temp1: 182,
              velocidad: 1.1,
              z: 0.85,
              ventana_inicio: "2026-09-23T07:50:00.000Z",
              ventana_fin: "2026-09-23T07:55:00.000Z",
            },
          },
        }),
      )

      const result = await api.getConsignaPropuesta("l-1")
      expect(result).toMatchObject({
        temp1: 182,
        velocidad: 1.1,
        z: 0.85,
        autorizada: false,
        fase: null,
        decision_id: null,
      })
    })

    it("devuelve null cuando el backend responde 204", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

      await expect(api.getConsignaPropuesta("l-1")).resolves.toBeNull()
    })

    it("devuelve null cuando falta la temperatura objetivo", async () => {
      fetchMock.mockResolvedValue(
        json({ success: true, data: { vel_objetivo: 1.2, autorizada: false } }),
      )

      await expect(api.getConsignaPropuesta("l-1")).resolves.toBeNull()
    })

    it("parsea los límites operativos cuando vienen en la propuesta", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            decision_id: "dec-1",
            temp1_objetivo: 180.5,
            vel_objetivo: 1.25,
            z: 0.95,
            autorizada: false,
            limites: {
              temp_min: 100,
              temp_max: 300,
              vel_min: 0.05,
              vel_max: 0.5,
              delta_temp1_max_c: 10,
              delta_vel_max: 0.05,
              tolerancia_temp_c: 2,
            },
          },
        }),
      )

      const result = await api.getConsignaPropuesta("l-1")
      expect(result).toMatchObject({
        temp1: 180.5,
        velocidad: 1.25,
        limites: {
          temp_min: 100,
          temp_max: 300,
          vel_min: 0.05,
          vel_max: 0.5,
          delta_temp1_max_c: 10,
          delta_vel_max: 0.05,
          tolerancia_temp_c: 2,
        },
      })
    })

    it("ignora límites incompletos sin rechazar la propuesta", async () => {
      fetchMock.mockResolvedValue(
        json({
          success: true,
          data: {
            temp1_objetivo: 180.5,
            vel_objetivo: 1.25,
            z: 0.95,
            autorizada: false,
            limites: { temp_min: 100 },
          },
        }),
      )

      const result = await api.getConsignaPropuesta("l-1")
      expect(result).toMatchObject({ temp1: 180.5, velocidad: 1.25, limites: null })
    })

    it("propaga un 5xx en vez de degradar a null", async () => {
      fetchMock.mockResolvedValue(json({ success: false, message: "" }, 500))

      await expect(api.getConsignaPropuesta("l-1")).rejects.toThrow("La API respondió con 500")
    })
  })
})
