// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HornoEstadoCard } from "@/components/horno/horno-estado-card"
import type { HornoEstado } from "@/lib/production-data"

function estado(overrides: Partial<HornoEstado> = {}): HornoEstado {
  return {
    id: "horno-1",
    nombre: "Horno 1",
    sector_id: "horno-1",
    lote_id: null,
    producto_id: null,
    temperatura: null,
    velocidad_cinta: null,
    estado: "SIN_LOTE",
    fuente: "sin_lote",
    ultimo_check: null,
    ...overrides,
  }
}

describe("HornoEstadoCard", () => {
  it("muestra telemetría completa con badge de éxito", () => {
    render(
      <HornoEstadoCard
        estado={estado({
          estado: "ACTIVO",
          fuente: "telemetria",
          ultimo_check: "2026-11-04T18:00:00Z",
          temperatura: 198.2,
          velocidad_cinta: 0.31,
          temp_comb_1: 0.78,
          humedad_horno: 35.2,
          temp_ambiente: 24.1,
          humedad_ambiente: 55.0,
          temp_objetivo: 200.0,
          vel_objetivo: 0.32,
          confianza_deteccion: 0.98,
          antiguedad_segundos: 3,
        })}
      />,
    )

    expect(screen.getByText("Horno 1")).toBeTruthy()
    expect(screen.getByText("Activo")).toBeTruthy()
    expect(screen.getByText(/Última telemetría de la Pi/)).toBeTruthy()

    expect(screen.getByText("198,2 °C")).toBeTruthy()
    expect(screen.getByText("0,31 m/s")).toBeTruthy()

    expect(screen.getByText("0,8 °C")).toBeTruthy()
    expect(screen.getByText("35,2 %")).toBeTruthy()
    expect(screen.getByText("24,1 °C")).toBeTruthy()
    expect(screen.getByText("55 %")).toBeTruthy()
    expect(screen.getByText("200 °C")).toBeTruthy()
    expect(screen.getByText("0,32 m/s")).toBeTruthy()
    expect(screen.getByText("98%")).toBeTruthy()

    expect(screen.queryByRole("status")).toBeNull()
  })

  it("SIN_LOTE muestra mensaje explicativo y no inventa lecturas", () => {
    render(<HornoEstadoCard estado={estado({ estado: "SIN_LOTE", fuente: "sin_lote" })} />)

    expect(screen.getByText("Horno 1")).toBeTruthy()
    expect(screen.getByText("SIN_LOTE")).toBeTruthy()
    expect(
      screen.getByText(
        "No hay un lote abierto en este sector. La Pi publica telemetría mientras hay un lote abierto.",
      ),
    ).toBeTruthy()

    const valores = screen.getAllByText("—")
    expect(valores.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText("185,3")).toBeNull()
    expect(screen.queryByText("0")).toBeNull()
    expect(screen.queryByText("0,0")).toBeNull()
  })

  it("SIN_TELEMETRIA muestra mensaje y emojis de valores ausentes", () => {
    render(
      <HornoEstadoCard
        estado={estado({
          estado: "SIN_TELEMETRIA",
          fuente: "sin_telemetria",
          lote_id: "lote-1",
          producto_id: "prod-1",
        })}
      />,
    )

    expect(screen.getByText("SIN_TELEMETRIA")).toBeTruthy()
    expect(
      screen.getByText("La Pi todavía no publicó telemetría para el lote abierto."),
    ).toBeTruthy()
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2)
  })

  it("valores null se muestran como — y nunca como 0", () => {
    render(
      <HornoEstadoCard
        estado={estado({
          estado: "SIN_DATOS",
          fuente: "telemetria",
          ultimo_check: "2026-11-04T18:00:00Z",
          temperatura: null,
          velocidad_cinta: null,
          temp_comb_1: null,
          humedad_horno: null,
          temp_ambiente: null,
          humedad_ambiente: null,
          temp_objetivo: null,
          vel_objetivo: null,
          confianza_deteccion: null,
        })}
      />,
    )

    expect(screen.getByText("SIN_DATOS")).toBeTruthy()
    expect(
      screen.getByText("La última muestra no trajo lecturas de los sensores."),
    ).toBeTruthy()

    // Temperatura, velocidad y las 7 métricas secundarias ausentes = 9 "—".
    expect(screen.getAllByText("—").length).toBe(9)
    expect(screen.queryByText("185,3")).toBeNull()
    expect(screen.queryByText("0")).toBeNull()
  })

  it("DESACTUALIZADO muestra advertencia con la antigüedad", () => {
    render(
      <HornoEstadoCard
        estado={estado({
          estado: "DESACTUALIZADO",
          fuente: "telemetria",
          ultimo_check: "2026-11-04T17:59:52Z",
          temperatura: 198.0,
          velocidad_cinta: 0.3,
          antiguedad_segundos: 12,
        })}
      />,
    )

    expect(screen.getByText("Desactualizado")).toBeTruthy()
    expect(screen.getByText(/La última muestra tiene 12 s/)).toBeTruthy()
  })

  it("estado null muestra el mensaje de error o el estado vacío por defecto", () => {
    render(<HornoEstadoCard estado={null} error="Timeout consultando la Pi." />)

    expect(screen.getByText("Timeout consultando la Pi.")).toBeTruthy()
    expect(screen.getByText("Datos no disponibles")).toBeTruthy()
  })
})
