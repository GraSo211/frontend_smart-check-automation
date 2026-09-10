// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useProductionData: vi.fn(),
  useMonitoringActions: vi.fn(),
}))

vi.mock("@/components/monitoring-provider", () => mocks)
vi.mock("@/components/lotes/kpi-cards", () => ({
  KpiCards: ({ runs }: { runs: Array<{ id: string }> }) => <div data-testid="kpis">{runs.length}</div>,
}))
vi.mock("@/components/lotes/filters-bar", () => ({
  DEFAULT_FILTERS: { search: "", turno: "todos", tempMin: "", tempMax: "" },
  FiltersBar: () => <div data-testid="filters" />,
}))
vi.mock("@/components/lotes/supervision-table", () => ({
  SupervisionTable: ({ runs }: { runs: Array<{ id: string }> }) => (
    <div data-testid="rows">{runs.map((run) => run.id).join(",")}</div>
  ),
}))

import { DashboardContent } from "@/components/lotes/dashboard-content"

const runs = [{
  id: "lote-confirmado",
  productoNombre: "Pan",
  turno: "mañana",
  tempHorno1: 180,
  tempHorno2: 180,
}] as never[]

class MockEventSource {
  addEventListener() {}
  close() {}
  set onopen(_handler: (() => void) | null) {}
  set onerror(_handler: (() => void) | null) {}
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
    mocks.useProductionData.mockReturnValue({
      runs,
      error: "API caída",
      loading: false,
      refresh: vi.fn(),
    })

    render(<DashboardContent runs={runs} lastSyncAt={null} />)

    expect(screen.getByRole("alert").textContent).toContain("No se pudo actualizar la producción")
    expect(screen.getByRole("alert").textContent).toContain("Se conservan los datos confirmados anteriores")
    expect(screen.getByTestId("rows").textContent).toContain("lote-confirmado")
  })

  it("muestra el error inicial sin confundirlo con un vacío válido", () => {
    mocks.useProductionData.mockReturnValue({ runs: [], error: "Servicio no disponible", loading: false, refresh: vi.fn() })

    render(<DashboardContent runs={[]} lastSyncAt={null} initialError="Servicio no disponible" />)

    expect(screen.getByRole("alert").textContent).toContain("Consulta no disponible")
    expect(screen.getByRole("alert").textContent).toContain("Servicio no disponible")
    expect(screen.queryByText("No hay datos de producción registrados para mostrar.")).toBeNull()
  })

  it("oculta el aviso cuando la consulta se recupera", () => {
    mocks.useProductionData
      .mockReturnValueOnce({ runs: [], error: "Servicio no disponible", loading: false, refresh: vi.fn() })
      .mockReturnValueOnce({ runs: [], error: null, loading: false, refresh: vi.fn() })

    const view = render(<DashboardContent runs={[]} lastSyncAt={null} initialError="Servicio no disponible" />)
    expect(screen.getByRole("alert")).toBeTruthy()

    view.rerender(<DashboardContent runs={[]} lastSyncAt={null} initialError="Servicio no disponible" />)

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("No hay datos de producción registrados para mostrar.")).toBeTruthy()
  })
})
