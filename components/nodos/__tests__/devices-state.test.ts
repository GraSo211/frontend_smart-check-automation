// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getDeviceHistoryPage: vi.fn(),
  actions: {
    acceptNodeEvent: vi.fn(),
    refreshNodes: vi.fn(),
    seedNodes: vi.fn(),
    streamState: vi.fn(),
  },
}))

vi.mock("@/actions/api", () => ({ getDeviceHistoryPage: mocks.getDeviceHistoryPage }))
vi.mock("@/components/monitoring-provider", () => ({
  useMonitoringNodes: () => null,
  useMonitoringActions: () => mocks.actions,
}))
vi.mock("@/components/nodos/device-card", () => ({
  DeviceCard: ({ device, onSelect }: { device: Device; onSelect: (id: string) => void }) => (
    React.createElement("button", { type: "button", onClick: () => onSelect(device.dispositivoId) }, device.nombre)
  ),
}))
vi.mock("@/components/nodos/telemetry-dashboard", () => ({
  TelemetryDashboard: ({ history }: { history: Array<{ id: string }> }) => React.createElement("output", { "data-testid": "recent" }, history.map((item) => item.id).join(",")),
}))
vi.mock("@/components/nodos/device-history", () => ({
  DeviceHistory: (props: { history: Array<{ id: string }>; total: number; page: number; newSamples?: number; onPageChange?: (page: number) => void; onRetry?: () => void; onLatest?: () => void }) => (
    React.createElement("div", null,
      React.createElement("output", { "data-testid": "history" }, props.history.map((item) => item.id).join(",")),
      React.createElement("output", { "data-testid": "history-meta" }, `${props.page}:${props.total}:${props.newSamples ?? 0}`),
      React.createElement("button", { type: "button", onClick: () => props.onPageChange?.(2) }, "page2"),
      React.createElement("button", { type: "button", onClick: () => props.onPageChange?.(999) }, "page999"),
      React.createElement("button", { type: "button", onClick: props.onRetry }, "retry"),
      React.createElement("button", { type: "button", onClick: props.onLatest }, "latest"),
    )
  ),
}))

import DevicesState from "@/components/nodos/devices-state"

type Device = {
  dispositivoId: string
  nombre: string
  ubicacion: string
  estado: "online" | "offline"
  lastSeen: string
  ultimaMetrica?: { id: string; dispositivoId: string; cpuPct: number; memRamDisponibleMb: number; tempChip: number; aiProcessorPct: number; receivedAt: string }
}
type Sample = { id: string; dispositivoId: string; nombre: string; cpuPct: number; memRamDisponibleMb: number; tempChip: number; aiProcessorPct: number; receivedAt: string }

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static readonly CLOSED = 2
  readonly CLOSED = 2
  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, (event: MessageEvent) => void>()
  close = vi.fn(() => { this.readyState = FakeEventSource.CLOSED })
  constructor() { FakeEventSource.instances.push(this) }
  addEventListener(name: string, listener: (event: MessageEvent) => void) { this.listeners.set(name, listener) }
  open() { this.readyState = 1; this.onopen?.() }
  error(closed = false) { this.readyState = closed ? FakeEventSource.CLOSED : 0; this.onerror?.() }
  emit(name: string, payload: unknown) { this.listeners.get(name)?.({ data: JSON.stringify(payload) } as MessageEvent) }
}

const at = "2026-01-01T10:00:00.000Z"
function device(id: string): Device { return { dispositivoId: id, nombre: id, ubicacion: "planta", estado: "online", lastSeen: at } }
function sample(id: string, deviceId: string, receivedAt = at): Sample { return { id, dispositivoId: deviceId, nombre: deviceId, cpuPct: 20, memRamDisponibleMb: 100, tempChip: 40, aiProcessorPct: 10, receivedAt } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }
function page(items: Sample[], total = items.length, requestedPage = 1) { return { items, total, page: requestedPage, pageSize: 20 } }

describe("estado headless de historial de nodos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
    mocks.actions.acceptNodeEvent.mockReturnValue(true)
    mocks.actions.refreshNodes.mockResolvedValue([device("A")])
    mocks.getDeviceHistoryPage.mockResolvedValue(page([]))
  })

  it("mezcla SSE recibido mientras HTTP está pendiente y conserva la muestra actual", async () => {
    const pending = deferred<ReturnType<typeof page>>()
    mocks.getDeviceHistoryPage.mockReturnValue(pending.promise)
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    const stream = FakeEventSource.instances[0]
    stream.emit("dispositivo.metric", { ...device("A"), ultimaMetrica: sample("live", "A", "2026-01-01T10:01:00.000Z") })
    await act(async () => pending.resolve(page([sample("http", "A")], 1)))
    expect(screen.getByTestId("history").textContent).toContain("live")
    expect(screen.getByTestId("recent").textContent).toContain("live")
  })

  it("ofrece actualizar recientes también desde página 1 sin inflar el total", async () => {
    const initial = Array.from({ length: 20 }, (_, index) => sample(`old-${index}`, "A", `2026-01-01T10:${String(index).padStart(2, "0")}:00.000Z`))
    const refreshed = [sample("live", "A", "2026-01-01T11:00:00.000Z"), ...initial.slice(0, 19)]
    mocks.getDeviceHistoryPage.mockResolvedValueOnce(page(initial, 20, 1)).mockResolvedValueOnce(page(refreshed, 21, 1)).mockResolvedValueOnce(page([sample("page2", "A")], 21, 2)).mockResolvedValueOnce(page([], 21, 1))
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    await act(async () => undefined)
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.emit("dispositivo.metric", { ...device("A"), ultimaMetrica: sample("live", "A", "2026-01-01T11:00:00.000Z") }))
    expect(screen.getByTestId("history-meta").textContent).toContain("1:20:1")
    await act(async () => fireEvent.click(screen.getByText("latest")))
    expect(screen.getByTestId("history-meta").textContent).toContain("1:21:0")
    fireEvent.click(screen.getByText("page2"))
    await act(async () => undefined)
    expect(screen.getByTestId("history-meta").textContent).toContain("2:21")
  })

  it("descarta una respuesta tardía de A después de seleccionar B", async () => {
    const old = deferred<ReturnType<typeof page>>()
    const current = deferred<ReturnType<typeof page>>()
    mocks.getDeviceHistoryPage.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    render(React.createElement(DevicesState, { devices: [device("A"), device("B")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByText("B"))
    await act(async () => old.resolve(page([sample("old", "A")])))
    expect(screen.getByTestId("history").textContent).not.toContain("old")
    await act(async () => current.resolve(page([sample("current", "B")])))
    expect(screen.getByTestId("history").textContent).toContain("current")
  })

  it("no inicia historial stale de A después de error SSE y selección de B", async () => {
    const historyA = deferred<ReturnType<typeof page>>()
    const historyB = deferred<ReturnType<typeof page>>()
    const firstSnapshot = deferred<Device[] | null>()
    const secondSnapshot = deferred<Device[] | null>()
    mocks.getDeviceHistoryPage.mockReturnValueOnce(historyA.promise).mockReturnValueOnce(historyB.promise)
    mocks.actions.refreshNodes.mockReturnValueOnce(firstSnapshot.promise).mockReturnValueOnce(secondSnapshot.promise)
    render(React.createElement(DevicesState, { devices: [device("A"), device("B")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.open())
    await act(async () => stream.error())
    fireEvent.click(screen.getByText("B"))
    await act(async () => { firstSnapshot.resolve([device("A")]); secondSnapshot.resolve([device("A")]) })
    expect(mocks.getDeviceHistoryPage).toHaveBeenCalledTimes(2)
    await act(async () => historyB.resolve(page([sample("current", "B")], 1, 1)))
    expect(screen.getByTestId("history").textContent).toContain("current")
    expect(screen.getByTestId("history-meta").textContent).toContain("1:1")
  })

  it("consulta páginas remotas sin mezclar SSE y mantiene el total mayor a cien", async () => {
    mocks.getDeviceHistoryPage.mockResolvedValueOnce(page([sample("one", "A")], 101, 1)).mockResolvedValueOnce(page([sample("page2", "A")], 101, 2)).mockResolvedValueOnce(page([], 101, 1))
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    await act(async () => undefined)
    fireEvent.click(screen.getByText("page2"))
    await act(async () => undefined)
    expect(screen.getByTestId("history").textContent).toBe("page2")
    expect(screen.getByTestId("history-meta").textContent).toContain("2:101")
  })

  it("reconsulta la última página antes de comprometer una respuesta fuera de rango", async () => {
    mocks.getDeviceHistoryPage
      .mockResolvedValueOnce(page([sample("one", "A")], 2000, 1))
      .mockResolvedValueOnce(page([sample("wrong", "A")], 101, 999))
      .mockResolvedValueOnce(page([], 101, 1))
      .mockResolvedValueOnce(page([sample("last", "A")], 101, 6))
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    await act(async () => undefined)
    fireEvent.click(screen.getByText("page999"))
    await act(async () => undefined)
    expect(screen.getByTestId("history").textContent).toBe("last")
    expect(screen.getByTestId("history-meta").textContent).toContain("6:101")
    expect(mocks.getDeviceHistoryPage).toHaveBeenLastCalledWith("A", 6, 20)
  })

  it("mantiene la página confirmada cuando falla la siguiente y permite reintentarla", async () => {
    mocks.getDeviceHistoryPage.mockResolvedValueOnce(page([sample("one", "A")], 40, 1)).mockRejectedValueOnce(new Error("caída")).mockResolvedValueOnce(page([], 40, 1)).mockResolvedValueOnce(page([sample("two", "A")], 40, 2))
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    fireEvent.click(screen.getByText("A"))
    await act(async () => undefined)
    fireEvent.click(screen.getByText("page2"))
    await act(async () => undefined)
    expect(screen.getByTestId("history-meta").textContent).toContain("1:40")
    fireEvent.click(screen.getByText("retry"))
    await act(async () => undefined)
    // Retry must target the failed remote page, not the last confirmed page.
    expect(mocks.getDeviceHistoryPage).toHaveBeenCalledWith("A", 2, 20)
    expect(screen.getByTestId("history-meta").textContent).toContain("2:40")
  })

  it("invalida open/error y exige snapshots antes de marcar conectado; CLOSED se recrea al reintentar", async () => {
    const firstSnapshot = deferred<Device[] | null>()
    const secondSnapshot = deferred<Device[] | null>()
    mocks.actions.refreshNodes.mockReturnValueOnce(firstSnapshot.promise).mockReturnValueOnce(secondSnapshot.promise)
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    const first = FakeEventSource.instances[0]
    await act(async () => first.open())
    await act(async () => first.error())
    await act(async () => { firstSnapshot.resolve([device("A")]); secondSnapshot.resolve([device("A")]) })
    expect(screen.getByText(/Nodos:/).textContent).not.toContain("Conectado")
    await act(async () => first.error(true))
    fireEvent.click(screen.getByText("Reintentar"))
    expect(FakeEventSource.instances.length).toBe(2)
  })

  it("no certifica el stream si el segundo snapshot falla", async () => {
    mocks.actions.refreshNodes.mockResolvedValueOnce([device("A")]).mockResolvedValueOnce(null)
    render(React.createElement(DevicesState, { devices: [device("A")], lastSyncAt: at }))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.open())
    expect(screen.getByText(/Nodos:/).textContent).not.toContain("Conectado")
  })
})
