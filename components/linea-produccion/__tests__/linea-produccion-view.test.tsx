// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Alerta, LoteSector, Producto, Sector } from "@/lib/production-data"
import { LineaProduccionView } from "@/components/linea-produccion/linea-produccion-view"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/components/lotes/control-card", () => ({
    ControlCard: ({ lote, canControl }: { lote: LoteSector; canControl: boolean }) => (
        <div
            data-testid="control-card"
            data-lote={lote.id}
            data-can-control={String(canControl)}
        />
    ),
}))

function sector(overrides: Partial<Sector> = {}): Sector {
    return { id: "s-1", nombre: "Sector Norte", ...overrides }
}

function producto(overrides: Partial<Producto> = {}): Producto {
    return {
        id: "p-1",
        nombre: "Tostada",
        activo: true,
        pesoReferenciaKg: 1,
        toleranciaPesoPct: 1,
        dimensionBaseCm: 1,
        toleranciaDimensionCm: 1,
        tempMin: 180,
        tempMax: 220,
        velocidadCintaMin: 0.5,
        velocidadCintaMax: 1.5,
        capacidadNominalKgH: null,
        ...overrides,
    }
}

function lote(overrides: Partial<LoteSector> = {}): LoteSector {
    return {
        id: "l-1",
        sector_id: "s-1",
        estado: "ABIERTO",
        producto_id: "p-1",
        producto_nombre: "Tostada",
        abierto_en: "2026-09-23T08:00:00.000Z",
        abierto_por: { device_id: "node-1", type: "ENTRADA_HORNO" },
        conteos: { ok: 90, crudo: 5, quemado: 5, total: 100 },
        ultimo_evento_en: "2026-09-23T08:30:00.000Z",
        inactividad_segundos: 5.4,
        cerrado_en: null,
        motivo_cierre: null,
        modo: "AUTOMATICO",
        ...overrides,
    }
}

function alerta(overrides: Partial<Alerta> = {}): Alerta {
    return {
        id: "a-1",
        sector_id: "s-1",
        lote_id: "l-1",
        tipo: "umbral_quemado",
        severidad: "WARNING",
        estado: "ACTIVA",
        mensaje: "Quemados por encima del umbral",
        created_at: "2026-09-23T08:45:00.000Z",
        acked_por: null,
        acked_at: null,
        ...overrides,
    }
}

function renderView(overrides: Partial<React.ComponentProps<typeof LineaProduccionView>> = {}) {
    return render(
        <LineaProduccionView
            sectores={[sector(), sector({ id: "s-2", nombre: "Sector Sur" })]}
            selectedSectorId="s-1"
            loteAbierto={lote()}
            producto={producto()}
            alertas={[]}
            canControl
            {...overrides}
        />,
    )
}

beforeEach(() => {
    mocks.push.mockReset()
})

describe("LineaProduccionView", () => {
    it("renderiza el selector de sector con el sector actual seleccionado", () => {
        renderView()
        const select = screen.getByLabelText("Sector") as HTMLSelectElement
        expect(select.value).toBe("s-1")
    })

    it("navega a ?sector_id=... cuando el usuario cambia el selector", () => {
        renderView()
        const select = screen.getByLabelText("Sector") as HTMLSelectElement
        fireEvent.change(select, { target: { value: "s-2" } })
        expect(mocks.push).toHaveBeenCalledWith("/linea-produccion?sector_id=s-2")
    })

    it("monta la tarjeta de control cuando hay lote abierto", () => {
        renderView()
        const card = screen.getByTestId("control-card")
        expect(card.getAttribute("data-lote")).toBe("l-1")
        expect(card.getAttribute("data-can-control")).toBe("true")
    })

    it("muestra empty state cuando no hay lote abierto", () => {
        renderView({ loteAbierto: null, producto: null })
        expect(screen.queryByTestId("control-card")).toBeNull()
        expect(screen.getByText(/no tiene un lote abierto/i)).toBeTruthy()
    })

    it("muestra los KPIs del lote abierto", () => {
        renderView()
        const kpis = screen.getByRole("region", { name: /Indicadores del lote/i })
        expect(kpis.textContent).toContain("100") // total
        expect(kpis.textContent).toContain("90") // ok
        expect(kpis.textContent).toContain("90%") // calidad
        expect(kpis.textContent).toContain("5 s") // inactividad redondeada
    })

    it("muestra el semáforo verde cuando el setpoint está dentro del rango", () => {
        renderView({ loteAbierto: lote({ temp1_objetivo: 200 }) })
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("En rango")
    })

    it("muestra el semáforo en rojo cuando el setpoint sale del rango", () => {
        renderView({ loteAbierto: lote({ temp1_objetivo: 250 }) })
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("Fuera de rango")
    })

    it("muestra el nivel warning cuando el setpoint está a menos del 5% del borde", () => {
        // Rango [180, 220] tiene span 40; 5% = 2. 219 está dentro del 5%
        // del borde superior => warning.
        renderView({ loteAbierto: lote({ temp1_objetivo: 219 }) })
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("En el borde")
    })

    it("se degrada con un mensaje neutro cuando el producto no está en el catálogo", () => {
        renderView({ loteAbierto: lote({ producto_id: "p-404" }), producto: null })
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("Producto del lote sin catálogo")
    })

    it("incluye el rango del producto cuando hay producto configurado", () => {
        renderView()
        expect(screen.getByText("Tostada")).toBeTruthy()
        expect(screen.getByText(/180 – 220 °C/)).toBeTruthy()
        expect(screen.getByText(/0,5 – 1,5 m\/s/)).toBeTruthy()
    })

    it("muestra las alertas activas del sector", () => {
        renderView({ alertas: [alerta()] })
        const panel = screen.getByRole("region", { name: /Alertas activas del sector/i })
        expect(panel.textContent).toContain("Quemados por encima del umbral")
        expect(panel.textContent).toContain("WARNING")
    })

    it("muestra un estado neutro cuando no hay alertas", () => {
        renderView({ alertas: [] })
        expect(screen.getByText(/Sin alertas activas en este sector/i)).toBeTruthy()
    })
})
