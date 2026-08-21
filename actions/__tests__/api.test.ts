import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.hoisted(() =>
  vi.fn(async () => ({
    get: vi.fn(() => ({ value: "jwt-token" })),
  })),
)
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

describe("device API server actions", () => {
  let api: typeof import("../api")
  const fetchMock = vi.fn()

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
  ])("forwards the incoming session cookie for %s", async (_name, action, method) => {
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

  it("does not build a backend URL with a trailing slash", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    )

    await api.getDevices()

    expect(fetchMock.mock.calls[0][0]).toBe("https://backend.example.test/api/v1/dispositivos")
  })
})
