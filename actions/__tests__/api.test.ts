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
    ubicacion: "Línea A",
    estado: "online",
    ultimaMetrica: validMetric,
    lastSeen: "2026-01-01T10:00:00.000Z",
  }
  const validRun = {
    id: "l-1",
    productoId: "p-1",
    productoNombre: "Producto",
    turno: "mañana",
    inicioAt: "2026-01-01T10:00:00.000Z",
    finAt: "2026-01-01T11:00:00.000Z",
    totalUnidades: 10,
    correctos: 9,
    quemados: 1,
    crudas: null,
    correctosKg: 1,
    quemadosKg: 1,
    crudosKg: null,
    tempHorno1: 100,
    tempCombHorno1: 20,
    tempHorno2: 100,
    tempCombHorno2: 20,
    velocidadCinta: 2,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
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
    ["getDevices", () => api.getDevices(), "GET"],
    ["getDeviceHistory", () => api.getDeviceHistory("node/1"), "GET"],
    ["createDispositivo", () => api.createDispositivo({ nombre: "Nodo", ubicacion: "Línea A" }), "POST"],
    ["updateDispositivo", () => api.updateDispositivo({ dispositivoId: "node-1", nombre: "Nodo", ubicacion: "Línea A" }), "PUT"],
    ["deleteDispositivo", () => api.deleteDispositivo("node/1"), "DELETE"],
  ])("reenvía la cookie de sesión para %s", async (_name, action, method) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: method === "DELETE" ? undefined : method === "GET" && _name === "getDevices" ? [] : method === "GET" ? [] : { dispositivoId: "node-1" },
        }),
        { status: 200 },
      ),
    )

    await action()

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method ?? "GET").toBe(method)
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      Cookie: "session_token=jwt-token",
    })
    expect(options.credentials).toBeUndefined()
  })

  it("acepta métricas live con id vacío en la respuesta de dispositivos", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [validDevice] }), { status: 200 }))

    await expect(api.getDevices()).resolves.toEqual([validDevice])
  })

  it("rechaza atómicamente una fila de dispositivos con telemetría numérica inválida", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: [validDevice, { ...validDevice, dispositivoId: "node-2", ultimaMetrica: { ...validMetric, cpuPct: "bad" } }],
    }), { status: 200 }))

    await expect(api.getDevices()).rejects.toThrow("respuesta inválida para dispositivos")
  })

  it("rechaza filas de producción con fechas inválidas en SSR", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: [{ ...validRun, finAt: "not-a-date" }],
    }), { status: 200 }))

    await expect(api.getAllProductionRuns()).rejects.toThrow("respuesta inválida para producción")
  })

  it("descarga todas las páginas de producción y conserva más de 100 filas", async () => {
    const runs = Array.from({ length: 101 }, (_, index) => ({ ...validRun, id: `l-${index}` }))
    fetchMock.mockImplementation(async (url: string) => {
      const page = new URL(url).searchParams.get("page") === "2" ? 2 : 1
      return new Response(JSON.stringify({
        success: true,
        data: page === 1 ? runs.slice(0, 100) : runs.slice(100),
        total: runs.length,
        page,
        pageSize: 100,
      }), { status: 200 })
    })

    await expect(api.getAllProductionRuns()).resolves.toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain("page=2&pageSize=100")
  })

  it("no devuelve producción parcial si falla una página posterior", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [validRun], total: 101, page: 1, pageSize: 100 }), { status: 200 }))
      .mockResolvedValueOnce(new Response("error", { status: 503, statusText: "Unavailable" }))

    await expect(api.getAllProductionRuns()).rejects.toThrow("La API respondió con 503")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("expone el historial de dispositivo con metadatos y URL de página", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: [],
      total: 41,
      page: 2,
      pageSize: 20,
    }), { status: 200 }))

    await expect(api.getDeviceHistoryPage("node/1", 2, 20)).resolves.toEqual({
      items: [], total: 41, page: 2, pageSize: 20,
    })
    expect(fetchMock.mock.calls[0][0]).toContain("dispositivoId=node%2F1&page=2&pageSize=20")
  })

  it.each([
    ["getAllProductionRuns", () => api.getAllProductionRuns(), "https://backend.example.test/api/v1/lotes-productivos?page=1&pageSize=100"],
    ["getDevices", () => api.getDevices(), "https://backend.example.test/api/v1/dispositivos"],
    ["getDeviceHistory", () => api.getDeviceHistory("node/1", 2, 10), "https://backend.example.test/api/v1/dispositivos/metricas?dispositivoId=node%2F1&page=2&pageSize=10"],
    ["getProductosConParametros", () => api.getProductosConParametros(), "https://backend.example.test/api/v1/parametros-producto"],
    ["getLotesPorProducto", () => api.getLotesPorProducto("product/1", 3, 7), "https://backend.example.test/api/v1/lotes-productivos?productoId=product%2F1&page=3&pageSize=7"],
  ])("obtiene datos reales y conserva la URL de paginación para %s", async (_name, action, expectedUrl) => {
    const data = _name === "getLotesPorProducto"
      ? { success: true, data: [], total: 0, page: 3, pageSize: 7 }
      : { success: true, data: [] }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }))

    const result = await action()

    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_token=jwt-token",
      },
    }))
    if (_name === "getLotesPorProducto") {
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 7 })
    } else {
      expect(result).toEqual([])
    }
  })

  it.each([
    ["getProductosConParametros", () => api.getProductosConParametros()],
    ["getLotesPorProducto", () => api.getLotesPorProducto("product-1")],
  ])("conserva un resultado vacío válido en %s", async (_name, action) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(
      _name === "getLotesPorProducto"
        ? { success: true, data: [], total: 0, page: 1, pageSize: 20 }
        : { success: true, data: [] },
    ), { status: 200 }))

    const result = await action()

    expect(result).toBeDefined()
    const items = _name === "getLotesPorProducto"
      ? (result as { items: unknown[] }).items
      : result
    expect(items).toEqual([])
  })

  it("conserva las formas de éxito de productos y lotes", async () => {
    const product = { id: "parameter-1", productoId: "product-1", productoNombre: "Producto real" }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [product] }), { status: 200 }))
    await expect(api.getProductosConParametros()).resolves.toEqual([product])

    const lote = { id: "batch-1", productoId: "product-1", turno: "mañana" }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [lote], total: 1, page: 2, pageSize: 10 }), { status: 200 }))
    await expect(api.getLotesPorProducto("product-1", 2, 10)).resolves.toEqual({
      items: [lote],
      total: 1,
      page: 2,
      pageSize: 10,
    })
  })

  it.each([
    ["getProductosConParametros", () => api.getProductosConParametros()],
    ["getLotesPorProducto", () => api.getLotesPorProducto("product-1")],
  ])("propaga un error HTTP en %s", async (_name, action) => {
    fetchMock.mockResolvedValue(new Response("error", { status: 500, statusText: "Internal Server Error" }))

    await expect(action()).rejects.toThrow("La API respondió con 500")
  })

  it.each([
    ["getProductosConParametros", () => api.getProductosConParametros()],
    ["getLotesPorProducto", () => api.getLotesPorProducto("product-1")],
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
    ["getLotesPorProducto", () => api.getLotesPorProducto("product-1")],
  ])("propaga errores de red en %s", async (_name, action) => {
    fetchMock.mockRejectedValue(new Error("network failure"))

    await expect(action()).rejects.toThrow("network failure")
  })

  it.each([
    ["getAllProductionRuns", () => api.getAllProductionRuns()],
    ["getProductosConParametros", () => api.getProductosConParametros()],
    ["getLotesPorProducto", () => api.getLotesPorProducto("product-1")],
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
    expect(error.message).not.toContain("muestra")
    vi.useRealTimers()
  })

  it.each([
    ["getProductosConParametros", (module: typeof import("../api")) => module.getProductosConParametros()],
    ["getLotesPorProducto", (module: typeof import("../api")) => module.getLotesPorProducto("product-1")],
  ])("falla explícitamente si falta NEXT_PUBLIC_API_URL en %s", async (_name, action) => {
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    delete process.env.NEXT_PUBLIC_API_URL
    vi.resetModules()
    const moduleWithoutUrl = await import("../api")

    await expect(action(moduleWithoutUrl)).rejects.toThrow("NEXT_PUBLIC_API_URL no está definida")

    process.env.NEXT_PUBLIC_API_URL = previousUrl
  })

  it.each([
    ["getProductosConParametros", () => api.getProductosConParametros(), { success: true, data: { not: "an array" } }],
    ["getLotesPorProducto", () => api.getLotesPorProducto("product-1"), { success: true, data: { not: "an array" } }],
    ["getAllProductionRuns", () => api.getAllProductionRuns(), { success: true, data: null }],
    ["getDevices", () => api.getDevices(), { success: true, data: null }],
    ["getDeviceHistory", () => api.getDeviceHistory("node-1"), { success: true, data: null }],
  ])("rechaza una respuesta malformada en %s en vez de convertirla en vacío", async (_name, action, body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    await expect(action()).rejects.toThrow("respuesta inválida")
  })

  it("no construye una URL con slash final", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }))

    await api.getDevices()

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/dispositivos")
  })

  it("envía el whepUrl normalizado al crear y lo omite cuando está vacío", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { dispositivoId: "node-1" } }), { status: 200 }))

    await api.createDispositivo({ nombre: "Nodo", ubicacion: "Línea A", whepUrl: "  https://cam.test/whep  " })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      nombre: "Nodo",
      ubicacion: "Línea A",
      whepUrl: "https://cam.test/whep",
    })

    fetchMock.mockClear()
    await api.createDispositivo({ nombre: "Nodo", ubicacion: "Línea A", whepUrl: "   " })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ nombre: "Nodo", ubicacion: "Línea A" })
  })

  it("envía el whepUrl al actualizar y lo copia de la respuesta", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { dispositivoId: "node-1", nombre: "Nodo", ubicacion: "Línea A", whepUrl: "https://cam.test/whep" },
    }), { status: 200 }))

    const result = await api.updateDispositivo({
      dispositivoId: "node-1",
      nombre: "Nodo",
      ubicacion: "Línea A",
      whepUrl: " https://cam.test/whep ",
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      dispositivoId: "node-1",
      nombre: "Nodo",
      ubicacion: "Línea A",
      whepUrl: "https://cam.test/whep",
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ dispositivoId: "node-1", whepUrl: "https://cam.test/whep" }),
    })
  })
})
