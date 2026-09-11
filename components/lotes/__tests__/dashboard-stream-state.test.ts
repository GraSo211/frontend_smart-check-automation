// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  actions: { acceptLoteEvent: vi.fn(), streamState: vi.fn() },
}))

vi.mock("@/components/monitoring-provider", () => ({
  useProductionData: () => ({ runs: [], error: null, loading: false, refresh: mocks.refresh }),
  useMonitoringActions: () => mocks.actions,
}))
vi.mock("@/components/lotes/kpi-cards", () => ({ KpiCards: () => React.createElement("div") }))
vi.mock("@/components/lotes/filters-bar", () => ({
  DEFAULT_FILTERS: { search: "", turno: "todos", tempMin: "", tempMax: "" },
  FiltersBar: () => React.createElement("div"),
}))
vi.mock("@/components/lotes/supervision-table", () => ({ SupervisionTable: () => React.createElement("div") }))

import { DashboardContent } from "@/components/lotes/dashboard-content"

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static readonly CLOSED = 2
  readonly CLOSED = 2
  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn(() => { this.readyState = FakeEventSource.CLOSED })
  constructor() { FakeEventSource.instances.push(this) }
  addEventListener() {}
  open() { this.readyState = 1; this.onopen?.() }
  error(closed = false) { this.readyState = closed ? FakeEventSource.CLOSED : 0; this.onerror?.() }
}

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }

describe("estado de conexión del stream de lotes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
  })

  it("no promueve connected después de un error aunque finalicen snapshots previos", async () => {
    const first = deferred<boolean>()
    const second = deferred<boolean>()
    mocks.refresh.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(React.createElement(DashboardContent, { runs: [], lastSyncAt: null }))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.open())
    await act(async () => stream.error())
    await act(async () => { first.resolve(true); second.resolve(true) })
    expect(screen.getByText(/Lotes:/).textContent).not.toContain("Conectado")
  })

  it("requiere que el segundo snapshot sea exitoso para certificar el stream", async () => {
    mocks.refresh.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    render(React.createElement(DashboardContent, { runs: [], lastSyncAt: null }))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.open())
    expect(screen.getByText(/Lotes:/).textContent).not.toContain("Conectado")
  })

  it("recrea el EventSource cuando CLOSED y se pulsa reintentar", async () => {
    mocks.refresh.mockResolvedValue(true)
    render(React.createElement(DashboardContent, { runs: [], lastSyncAt: null }))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.error(true))
    fireEvent.click(screen.getByText("Reintentar"))
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(stream.close).toHaveBeenCalled()
  })
})
