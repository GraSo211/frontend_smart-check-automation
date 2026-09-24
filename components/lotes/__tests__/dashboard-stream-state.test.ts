// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { LoteSector, Sector } from "@/lib/production-data"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  actions: { acceptLoteEvent: vi.fn(), streamState: vi.fn() },
  runs: { current: [] as LoteSector[] },
  error: { current: null as string | null },
  truncated: { current: false },
  routerPush: vi.fn(),
}))

vi.mock("@/components/monitoring-provider", () => ({
  useProductionData: () => ({ runs: mocks.runs.current, error: mocks.error.current, loading: false, truncated: mocks.truncated.current, refresh: mocks.refresh }),
  useMonitoringActions: () => mocks.actions,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.routerPush }) }))

import { DashboardContent } from "@/components/lotes/dashboard-content"
import { KpiCards } from "@/components/lotes/kpi-cards"

const sectores: Sector[] = [
  { id: "s-1", nombre: "Sector Norte" },
  { id: "s-2", nombre: "Sector Sur" },
]

function lote(overrides: Partial<LoteSector> = {}): LoteSector {
  return {
    id: "l-1",
    sector_id: "s-1",
    estado: "CERRADO",
    producto_id: "p-1",
    producto_nombre: "Pan",
    abierto_en: "2026-09-23T08:00:00.000Z",
    abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
    conteos: { ok: 90, crudo: 2, quemado: 8, total: 100 },
    ultimo_evento_en: "2026-09-23T09:00:00.000Z",
    inactividad_segundos: 12.5,
    cerrado_en: "2026-09-23T09:30:00.000Z",
    motivo_cierre: "FIN",
    ...overrides,
  }
}

function props(overrides: Partial<React.ComponentProps<typeof DashboardContent>> = {}): React.ComponentProps<typeof DashboardContent> {
  return {
    runs: [],
    lastSyncAt: null,
    sectores,
    selectedSectorId: "s-1",
    initialLoteAbierto: null,
    ...overrides,
  }
}

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static readonly CLOSED = 2
  readonly CLOSED = 2
  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>()
  close = vi.fn(() => { this.readyState = FakeEventSource.CLOSED })
  constructor() { FakeEventSource.instances.push(this) }
  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(handler)
    this.listeners.set(type, list)
  }
  emit(type: string, data: string) {
    for (const handler of this.listeners.get(type) ?? []) handler({ data } as MessageEvent)
  }
  open() { this.readyState = 1; this.onopen?.() }
  error(closed = false) { this.readyState = closed ? FakeEventSource.CLOSED : 0; this.onerror?.() }
}

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }

describe("estado de conexión del stream de lotes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runs.current = []
    mocks.error.current = null
    mocks.truncated.current = false
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
  })

  it("no promueve connected después de un error aunque finalicen snapshots previos", async () => {
    const first = deferred<boolean>()
    const second = deferred<boolean>()
    mocks.refresh.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(React.createElement(DashboardContent, props()))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.open())
    await act(async () => stream.error())
    await act(async () => { first.resolve(true); second.resolve(true) })
    expect(screen.getByText(/Lotes:/).textContent).not.toContain("Conectado")
  })

  it("requiere que el segundo snapshot sea exitoso para certificar el stream", async () => {
    mocks.refresh.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    render(React.createElement(DashboardContent, props()))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.open())
    expect(screen.getByText(/Lotes:/).textContent).not.toContain("Conectado")
  })

  it("recrea el EventSource cuando CLOSED y se pulsa reintentar", async () => {
    mocks.refresh.mockResolvedValue(true)
    render(React.createElement(DashboardContent, props()))
    const stream = FakeEventSource.instances[0]
    await act(async () => stream.error(true))
    fireEvent.click(screen.getByText("Reintentar"))
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(stream.close).toHaveBeenCalled()
  })

  it("entrega los tres eventos SSE al proveedor", async () => {
    mocks.refresh.mockResolvedValue(true)
    render(React.createElement(DashboardContent, props()))
    const stream = FakeEventSource.instances[0]

    const creado = { id: "l-1", estado: "ABIERTO" }
    const actualizado = { id: "l-1", estado: "ABIERTO", conteos: { total: 5 } }
    const cerrado = { id: "l-1", estado: "CERRADO" }

    await act(async () => {
      stream.emit("lote.creado", JSON.stringify(creado))
      stream.emit("lote.actualizado", JSON.stringify(actualizado))
      stream.emit("lote.cerrado", JSON.stringify(cerrado))
    })

    expect(mocks.actions.acceptLoteEvent).toHaveBeenCalledTimes(3)
    expect(mocks.actions.acceptLoteEvent).toHaveBeenNthCalledWith(1, creado)
    expect(mocks.actions.acceptLoteEvent).toHaveBeenNthCalledWith(2, actualizado)
    expect(mocks.actions.acceptLoteEvent).toHaveBeenNthCalledWith(3, cerrado)
  })

  it("ignora un evento SSE malformado sin confirmar sincronización", async () => {
    mocks.refresh.mockResolvedValue(true)
    render(React.createElement(DashboardContent, props()))
    const stream = FakeEventSource.instances[0]

    await act(async () => {
      stream.emit("lote.creado", "{ no es json")
    })

    expect(mocks.actions.acceptLoteEvent).not.toHaveBeenCalled()
  })
})

describe("dashboard de lotes por sector", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runs.current = []
    mocks.error.current = null
    mocks.truncated.current = false
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
  })

  it("solo muestra los lotes del sector seleccionado", () => {
    const norte = lote({ id: "l-norte", sector_id: "s-1", producto_nombre: "Pan" })
    const sur = lote({ id: "l-sur", sector_id: "s-2", producto_nombre: "Facturas" })
    mocks.runs.current = [norte, sur]

    render(React.createElement(DashboardContent, props({ runs: [norte, sur], selectedSectorId: "s-1" })))

    expect(screen.getByText("Pan")).toBeTruthy()
    expect(screen.queryByText("Facturas")).toBeNull()
  })

  it("muestra todos los sectores cuando no hay sector seleccionado", () => {
    const norte = lote({ id: "l-norte", sector_id: "s-1", producto_nombre: "Pan" })
    const sur = lote({ id: "l-sur", sector_id: "s-2", producto_nombre: "Facturas" })
    mocks.runs.current = [norte, sur]

    render(React.createElement(DashboardContent, props({ runs: [norte, sur], selectedSectorId: null })))

    expect(screen.getByText("Pan")).toBeTruthy()
    expect(screen.getByText("Facturas")).toBeTruthy()
  })

  it("renderiza «—» en los buckets nulos y en las columnas fuera del contrato", () => {
    const vacio = lote({ id: "l-vacio", conteos: { ok: null, crudo: null, quemado: null, total: 0 } })
    mocks.runs.current = [vacio]

    render(React.createElement(DashboardContent, props({ runs: [vacio] })))

    // Turno, Correctos, Quemados, Crudas, Temperaturas y Vel. cinta.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6)
  })

  it("avisa cuando el lote fue abierto por la salida del horno", () => {
    const abierto = lote({
      id: "l-abierto",
      estado: "ABIERTO",
      cerrado_en: null,
      abierto_por: { device_id: "d-9", type: "SALIDA_HORNO" },
    })

    render(React.createElement(DashboardContent, props({ initialLoteAbierto: abierto })))

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Lote degradado")
    expect(alert.textContent).toContain("salida")
  })

  it("avisa cuando no hay dispositivo de apertura registrado", () => {
    const abierto = lote({ id: "l-abierto", estado: "ABIERTO", cerrado_en: null, abierto_por: null })

    render(React.createElement(DashboardContent, props({ initialLoteAbierto: abierto })))

    expect(screen.getByRole("alert").textContent).toContain("Lote degradado")
  })

  it("muestra un estado vacío si no hay lote abierto", () => {
    render(React.createElement(DashboardContent, props({ initialLoteAbierto: null })))

    expect(screen.getByText("Sin lote abierto en este sector")).toBeTruthy()
  })

  it("no avisa cuando el lote fue abierto por la entrada del horno", () => {
    const abierto = lote({
      id: "l-abierto",
      estado: "ABIERTO",
      cerrado_en: null,
      conteos: { ok: null, crudo: null, quemado: null, total: 0 },
      abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
    })

    render(React.createElement(DashboardContent, props({ initialLoteAbierto: abierto })))

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Lote abierto · Sector Norte")).toBeTruthy()
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3)
  })

  it("conserva las filas visibles mientras informa un fallo de actualización", () => {
    const confirmado = lote({ id: "lote-confirmado", producto_nombre: "Pan" })
    mocks.runs.current = [confirmado]
    mocks.error.current = "API caída"

    render(React.createElement(DashboardContent, props({ runs: [confirmado] })))

    expect(screen.getByRole("alert").textContent).toContain("No se pudo actualizar la producción")
    expect(screen.getByRole("alert").textContent).toContain("Se conservan los datos confirmados anteriores")
    expect(screen.getByText("Pan")).toBeTruthy()
  })

  it("muestra el error inicial sin confundirlo con un vacío válido", () => {
    mocks.error.current = "Servicio no disponible"
    mocks.runs.current = []

    render(React.createElement(DashboardContent, props({ initialError: "Servicio no disponible" })))

    expect(screen.getByRole("alert").textContent).toContain("Consulta no disponible")
    expect(screen.getByRole("alert").textContent).toContain("Servicio no disponible")
    expect(screen.queryByText("No hay datos de producción registrados para mostrar.")).toBeNull()
  })

  it("oculta el aviso cuando la consulta se recupera", () => {
    mocks.error.current = "Servicio no disponible"
    mocks.runs.current = []

    const view = render(React.createElement(DashboardContent, props({ initialError: "Servicio no disponible" })))
    expect(screen.getByRole("alert")).toBeTruthy()

    mocks.error.current = null
    view.rerender(React.createElement(DashboardContent, props({ initialError: "Servicio no disponible" })))

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("No hay datos de producción registrados para mostrar.")).toBeTruthy()
  })

  it("P0: no resucita como abierto un lote que el store ya vio cerrar", () => {
    const abierto = lote({ id: "l-1", estado: "ABIERTO", cerrado_en: null })

    // First render: the live store has not seen the id yet, so the seeded open
    // lote is a valid fallback.
    mocks.runs.current = []
    const view = render(
      React.createElement(DashboardContent, props({ initialLoteAbierto: abierto })),
    )
    expect(screen.getByText("Lote abierto · Sector Norte")).toBeTruthy()

    // Simulate the SSE `lote.cerrado` upserting the same id as CERRADO into the
    // global store, then re-render with the unchanged seeded fallback.
    mocks.runs.current = [
      lote({ id: "l-1", estado: "CERRADO", cerrado_en: "2026-09-23T09:30:00.000Z" }),
    ]
    view.rerender(
      React.createElement(DashboardContent, props({ initialLoteAbierto: abierto })),
    )

    expect(screen.queryByText("Lote abierto · Sector Norte")).toBeNull()
    expect(screen.getByText("Sin lote abierto en este sector")).toBeTruthy()
  })

  it("no muestra la nota de truncado cuando el snapshot es completo", () => {
    mocks.truncated.current = false
    render(React.createElement(DashboardContent, props()))

    expect(
      screen.queryByText("Mostrando los lotes más recientes; hay historial más antiguo disponible."),
    ).toBeNull()
  })

  it("advierte cuando el snapshot global quedó truncado", () => {
    mocks.truncated.current = true
    render(React.createElement(DashboardContent, props()))

    expect(
      screen.getByText("Mostrando los lotes más recientes; hay historial más antiguo disponible."),
    ).toBeTruthy()
  })
})

describe("regla null-vs-cero en los KPI de lotes", () => {
  it("muestra «—» en calidad cuando ningún lote emite el bucket ok", () => {
    render(
      React.createElement(KpiCards, {
        runs: [lote({ id: "l-null-ok", conteos: { ok: null, crudo: 4, quemado: 6, total: 100 } })],
      }),
    )
    expect(screen.getByText("Tasa de calidad general").parentElement?.textContent).toContain("—")
    expect(screen.getByText("Tasa de merma").parentElement?.textContent).toContain("10.0%")
  })

  it("muestra «—» en merma cuando ningún lote emite quemado ni crudo", () => {
    render(
      React.createElement(KpiCards, {
        runs: [lote({ id: "l-null-waste", conteos: { ok: 90, crudo: null, quemado: null, total: 100 } })],
      }),
    )
    expect(screen.getByText("Tasa de calidad general").parentElement?.textContent).toContain("90.0%")
    expect(screen.getByText("Tasa de merma").parentElement?.textContent).toContain("—")
  })

  it("publica la tasa real cuando existe al menos un valor real", () => {
    render(
      React.createElement(KpiCards, {
        runs: [lote({ id: "l-real", conteos: { ok: 80, crudo: 5, quemado: 15, total: 100 } })],
      }),
    )
    expect(screen.getByText("Tasa de calidad general").parentElement?.textContent).toContain("80.0%")
    expect(screen.getByText("Tasa de merma").parentElement?.textContent).toContain("20.0%")
  })
})
