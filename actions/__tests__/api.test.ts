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
    nombre: "Nodo 1",
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
    ultimo_evento_en: "2026-01-01T10:05:00.000Z",
    inactividad_segundos: 12.5,
  }
  const sector = { id: "s-1", nombre: "Horno 1" }
  const producto = { id: "p-1", nombre: "Tostada", activo: true }
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
    ["getDeviceHistory", () => api.getDeviceHistory("node/1"), "GET", { success: true, data: [] }],
    ["getSectores", () => api.getSectores(), "GET", { success: true, data: [] }],
    ["getProductos", () => api.getProductos(), "GET", { success: true, data: [] }],
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
    ["getDeviceHistory", () => api.getDeviceHistory("node/1", 2, 10), "https://backend.example.test/api/v1/dispositivos/metricas?dispositivoId=node%2F1&page=2&pageSize=10"],
    ["getProductosConParametros", () => api.getProductosConParametros(), "https://backend.example.test/api/v1/parametros-producto"],
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

  it("conserva un resultado vacío válido en getProductosConParametros", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    await expect(api.getProductosConParametros()).resolves.toEqual([])
  })

  it("conserva las formas de éxito de productos", async () => {
    const product = { id: "parameter-1", productoId: "product-1", productoNombre: "Producto real" }
    fetchMock.mockResolvedValue(json({ success: true, data: [product] }))
    await expect(api.getProductosConParametros()).resolves.toEqual([product])
  })

  it.each([
    ["getProductosConParametros", () => api.getProductosConParametros()],
  ])("propaga un error HTTP en %s", async (_name, action) => {
    fetchMock.mockResolvedValue(json("error", 500))

    await expect(action()).rejects.toThrow("La API respondió con 500")
  })

  it.each([
    ["getProductosConParametros", () => api.getProductosConParametros()],
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
    ["getProductosConParametros", () => api.getProductosConParametros()],
  ])("propaga errores de red en %s", async (_name, action) => {
    fetchMock.mockRejectedValue(new Error("network failure"))

    await expect(action()).rejects.toThrow("network failure")
  })

  it.each([
    ["getSectores", () => api.getSectores()],
    ["getProductos", () => api.getProductos()],
    ["getLotes", () => api.getLotes("s-1")],
    ["getLoteAbierto", () => api.getLoteAbierto("s-1")],
    ["getProductosConParametros", () => api.getProductosConParametros()],
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
    ["getProductos", (module: typeof import("../api")) => module.getProductos()],
    ["getLotes", (module: typeof import("../api")) => module.getLotes("s-1")],
    ["getProductosConParametros", (module: typeof import("../api")) => module.getProductosConParametros()],
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
    ["getProductos", () => api.getProductos(), { success: true, data: { not: "an array" } }, "respuesta inválida para productos"],
    ["getLotes", () => api.getLotes("s-1"), { success: true, data: null }, "respuesta inválida para el historial de lotes"],
    ["getLoteAbierto", () => api.getLoteAbierto("s-1"), { success: true, data: null }, "respuesta inválida para el lote abierto"],
    ["getProductosConParametros", () => api.getProductosConParametros(), { success: true, data: { not: "an array" } }, "respuesta inválida"],
    ["getDevices", () => api.getDevices(), { success: true, data: null }, "respuesta inválida"],
    ["getDeviceHistory", () => api.getDeviceHistory("node-1"), { success: true, data: null }, "respuesta inválida"],
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

  it("envía el whepUrl y el sectorId al actualizar y los copia de la respuesta", async () => {
    fetchMock.mockResolvedValue(json({
      success: true,
      data: { ...validDeviceRead, whepUrl: "https://cam.test/whep" },
    }))

    const result = await api.updateDispositivo({
      dispositivoId: "node-1",
      sectorId: "s-1",
      whepUrl: " https://cam.test/whep ",
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      dispositivoId: "node-1",
      sectorId: "s-1",
      whepUrl: "https://cam.test/whep",
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ dispositivoId: "node-1", sectorId: "s-1", whepUrl: "https://cam.test/whep" }),
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
      errors: ["El sector ya tiene un nodo con ese rol (entrada o salida)."],
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
    fetchMock.mockResolvedValue(json({ success: true, data: { id: "s/1", nombre: "Horno 2" } }))

    const result = await api.updateSector({ id: "s/1", nombre: "Horno 2" })

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/sectores/s%2F1")
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ nombre: "Horno 2" })
    expect(result).toEqual({ ok: true, data: { id: "s/1", nombre: "Horno 2" } })
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

  it("obtiene los productos y valida activo booleano", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [producto] }))

    await expect(api.getProductos()).resolves.toEqual([producto])
    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/productos")
  })

  it("rechaza productos con filas inválidas", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [{ id: "p-1", nombre: "Tostada", activo: "si" }] }))

    await expect(api.getProductos()).rejects.toThrow("respuesta inválida para productos")
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

  it("usa ApiError 401 en getSectores, getProductos, getLotes y getLoteAbierto", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }))
    for (const action of [api.getSectores(), api.getProductos(), api.getLotes("s-1"), api.getLoteAbierto("s-1")]) {
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

  it("getAllLotes itera los sectores y sigue el cursor de cada uno", async () => {
    const loteFor = (id: string, sectorId: string) => ({ ...validLote, id, sector_id: sectorId })
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith("/sectores")) {
        return json({ success: true, data: [sector, { id: "s-2", nombre: "Horno 2" }] })
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

  it("getAllLotes es atómico: si falla un sector no publica una colección parcial", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith("/sectores")) {
        return json({ success: true, data: [sector, { id: "s-2", nombre: "Horno 2" }] })
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
})
