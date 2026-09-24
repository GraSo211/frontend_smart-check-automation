// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useProductionData: vi.fn(),
  useMonitoringActions: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock("@/components/monitoring-provider", () => ({
  useProductionData: mocks.useProductionData,
  useMonitoringActions: mocks.useMonitoringActions,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))
vi.mock("@/components/lotes/kpi-cards", () => ({
  KpiCards: ({ runs }: { runs: Array<{ id: string }> }) => <div data-testid="kpis">{runs.length}</div>,
}))
vi.mock("@/components/lotes/filters-bar", () => ({
  DEFAULT_FILTERS: { search: "", estado: "todos" },
  FiltersBar: () => <div data-testid="filters" />,
}))

import { DashboardContent } from "@/components/lotes/dashboard-content"
import type { LoteSector, Sector } from "@/lib/production-data"

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

class MockEventSource {
  addEventListener() {}
  close() {}
  set onopen(_handler: (() => void) | null) {}
  set onerror(_handler: (() => void) | null) {}
}

function renderDashboard(overrides: Partial<Parameters<typeof DashboardContent>[0]> = {}) {
  return render(
    <DashboardContent
      runs={[]}
      lastSyncAt={null}
      sectores={sectores}
      selectedSectorId="s-1"
      initialLoteAbierto={null}
      {...overrides}
    />,
  )
}

describe("estado de datos de lotes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("EventSource", MockEventSource)
    mocks.useMonitoringActions.mockReturnValue({
      acceptLoteEvent: vi.fn(),
      streamState: vi.fn(),
    })
  })

  it("conserva las filas visibles mientras informa un fallo de actualización", () => {
    const confirmed = lote({ id: "lote-confirmado", producto_nombre: "Pan" })
    mocks.useProductionData.mockReturnValue({
      runs: [confirmed],
      error: "API caída",
      loading: false, truncated: false,
      refresh: vi.fn(),
    })

    renderDashboard({ runs: [confirmed] })

    expect(screen.getByRole("alert").textContent).toContain("No se pudo actualizar la producción")
    expect(screen.getByRole("alert").textContent).toContain("Se conservan los datos confirmados anteriores")
    expect(screen.getByText("Pan")).toBeTruthy()
  })

  it("muestra el error inicial sin confundirlo con un vacío válido", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: "Servicio no disponible", loading: false, truncated: false, refresh: vi.fn() })

    renderDashboard({ initialError: "Servicio no disponible" })

    expect(screen.getByRole("alert").textContent).toContain("Consulta no disponible")
    expect(screen.getByRole("alert").textContent).toContain("Servicio no disponible")
    expect(screen.queryByText("No hay datos de producción registrados para mostrar.")).toBeNull()
  })

  it("oculta el aviso cuando la consulta se recupera", () => {
    mocks.useProductionData
      .mockReturnValueOnce({ runs: [], error: "Servicio no disponible", loading: false, truncated: false, refresh: vi.fn() })
      .mockReturnValueOnce({ runs: [], error: null, loading: false, truncated: false, refresh: vi.fn() })

    const view = renderDashboard({ initialError: "Servicio no disponible" })
    expect(screen.getByRole("alert")).toBeTruthy()

    view.rerender(
      <DashboardContent
        runs={[]}
        lastSyncAt={null}
        sectores={sectores}
        selectedSectorId="s-1"
        initialLoteAbierto={null}
        initialError="Servicio no disponible"
      />,
    )

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("No hay datos de producción registrados para mostrar.")).toBeTruthy()
  })
})

describe("filtrado por sector", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("EventSource", MockEventSource)
    mocks.useMonitoringActions.mockReturnValue({
      acceptLoteEvent: vi.fn(),
      streamState: vi.fn(),
    })
  })

  it("solo muestra los lotes del sector seleccionado", () => {
    const norte = lote({ id: "l-norte", sector_id: "s-1", producto_nombre: "Pan" })
    const sur = lote({ id: "l-sur", sector_id: "s-2", producto_nombre: "Facturas" })
    mocks.useProductionData.mockReturnValue({
      runs: [norte, sur],
      error: null,
      loading: false, truncated: false,
      refresh: vi.fn(),
    })

    renderDashboard({ runs: [norte, sur], selectedSectorId: "s-1" })

    expect(screen.getByText("Pan")).toBeTruthy()
    expect(screen.queryByText("Facturas")).toBeNull()
    expect(screen.getByTestId("kpis").textContent).toBe("1")
  })

  it("muestra todos los sectores cuando no hay sector seleccionado", () => {
    const norte = lote({ id: "l-norte", sector_id: "s-1", producto_nombre: "Pan" })
    const sur = lote({ id: "l-sur", sector_id: "s-2", producto_nombre: "Facturas" })
    mocks.useProductionData.mockReturnValue({
      runs: [norte, sur],
      error: null,
      loading: false, truncated: false,
      refresh: vi.fn(),
    })

    renderDashboard({ runs: [norte, sur], selectedSectorId: null })

    expect(screen.getByText("Pan")).toBeTruthy()
    expect(screen.getByText("Facturas")).toBeTruthy()
  })
})

describe("placeholders del contrato sector/lotes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("EventSource", MockEventSource)
    mocks.useMonitoringActions.mockReturnValue({
      acceptLoteEvent: vi.fn(),
      streamState: vi.fn(),
    })
  })

  it("renderiza «—» en los buckets nulos y en las columnas fuera del contrato", () => {
    const vacio = lote({
      id: "l-vacio",
      conteos: { ok: null, crudo: null, quemado: null, total: 0 },
    })
    mocks.useProductionData.mockReturnValue({
      runs: [vacio],
      error: null,
      loading: false, truncated: false,
      refresh: vi.fn(),
    })

    renderDashboard({ runs: [vacio] })

    // Turno, Correctos, Quemados, Crudas, Temperaturas y Vel. cinta.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6)
  })
})

describe("lote abierto y lotes degradados", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("EventSource", MockEventSource)
    mocks.useMonitoringActions.mockReturnValue({
      acceptLoteEvent: vi.fn(),
      streamState: vi.fn(),
    })
  })

  it("avisa cuando el lote fue abierto por la salida del horno", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: null, loading: false, truncated: false, refresh: vi.fn() })
    const abierto = lote({
      id: "l-abierto",
      estado: "ABIERTO",
      cerrado_en: null,
      abierto_por: { device_id: "d-9", type: "SALIDA_HORNO" },
    })

    renderDashboard({ initialLoteAbierto: abierto })

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Lote degradado")
    expect(alert.textContent).toContain("salida")
  })

  it("avisa cuando no hay dispositivo de apertura registrado", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: null, loading: false, truncated: false, refresh: vi.fn() })
    const abierto = lote({
      id: "l-abierto",
      estado: "ABIERTO",
      cerrado_en: null,
      abierto_por: null,
    })

    renderDashboard({ initialLoteAbierto: abierto })

    expect(screen.getByRole("alert").textContent).toContain("Lote degradado")
  })

  it("no avisa cuando el lote fue abierto por la entrada del horno", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: null, loading: false, truncated: false, refresh: vi.fn() })
    const abierto = lote({
      id: "l-abierto",
      estado: "ABIERTO",
      cerrado_en: null,
      conteos: { ok: null, crudo: null, quemado: null, total: 0 },
      abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
    })

    renderDashboard({ initialLoteAbierto: abierto })

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Lote abierto · Sector Norte")).toBeTruthy()
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3)
  })

  it("muestra un estado vacío si no hay lote abierto", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: null, loading: false, truncated: false, refresh: vi.fn() })

    renderDashboard({ initialLoteAbierto: null })

    expect(screen.getByText("Sin lote abierto en este sector")).toBeTruthy()
  })

  it("P0: no resucita como abierto un lote que el store ya vio cerrar", () => {
    let storeRuns: LoteSector[] = []
    mocks.useProductionData.mockImplementation(() => ({
      runs: storeRuns,
      error: null,
      loading: false,
      truncated: false,
      refresh: vi.fn(),
    }))
    const abierto = lote({ id: "l-1", estado: "ABIERTO", cerrado_en: null })

    const view = renderDashboard({ initialLoteAbierto: abierto })
    expect(screen.getByText("Lote abierto · Sector Norte")).toBeTruthy()

    // The SSE `lote.cerrado` upserts the same id as CERRADO into the store.
    storeRuns = [lote({ id: "l-1", estado: "CERRADO", cerrado_en: "2026-09-23T09:30:00.000Z" })]
    view.rerender(
      <DashboardContent
        runs={[]}
        lastSyncAt={null}
        sectores={sectores}
        selectedSectorId="s-1"
        initialLoteAbierto={abierto}
      />,
    )

    expect(screen.queryByText("Lote abierto · Sector Norte")).toBeNull()
    expect(screen.getByText("Sin lote abierto en este sector")).toBeTruthy()
  })

  it("advierte cuando el snapshot quedó truncado", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: null, loading: false, truncated: true, refresh: vi.fn() })

    renderDashboard()

    expect(
      screen.getByText("Mostrando los lotes más recientes; hay historial más antiguo disponible."),
    ).toBeTruthy()
  })

  it("no muestra la nota de truncado cuando el snapshot es completo", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: null, loading: false, truncated: false, refresh: vi.fn() })

    renderDashboard()

    expect(
      screen.queryByText("Mostrando los lotes más recientes; hay historial más antiguo disponible."),
    ).toBeNull()
  })
})
