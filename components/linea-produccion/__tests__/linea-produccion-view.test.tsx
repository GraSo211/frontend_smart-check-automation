// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Device, SpecificDevice } from "@/lib/devices-data"
import type { LoteSector, Producto, Sector } from "@/lib/production-data"
import { LineaProduccionView } from "@/components/linea-produccion/linea-produccion-view"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/components/nodos/telemetry-dashboard", () => ({
    // Mock del dashboard: mantiene un anchor con el id del dispositivo para que
    // los tests puedan asegurar que se monta con la ENTRADA_HORNO correcta.
    TelemetryDashboard: ({ device }: { device: Device }) =>
        React.createElement(
            "div",
            { "data-testid": "telemetry-dashboard", "data-device": device.dispositivoId },
            `dashboard for ${device.nombre}`,
        ),
}))

function sector(overrides: Partial<Sector> = {}): Sector {
    return { id: "s-1", nombre: "Sector Norte", ...overrides }
}

function device(overrides: Partial<Device> = {}): Device {
    return {
        dispositivoId: "node-1",
        nombre: "Raspberry Norte",
        sectorId: "s-1",
        type: "ENTRADA_HORNO",
        estado: "online",
        lastSeen: "2026-09-23T08:00:00.000Z",
        ...overrides,
    }
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
        conteos: { ok: 10, crudo: 0, quemado: 0, total: 10 },
        ultimo_evento_en: "2026-09-23T08:30:00.000Z",
        inactividad_segundos: 5,
        cerrado_en: null,
        motivo_cierre: null,
        modo: "AUTOMATICO",
        ...overrides,
    }
}

const sampleHistory: SpecificDevice[] = [
    {
        id: "m-1",
        dispositivoId: "node-1",
        nombre: "Raspberry Norte",
        cpuPct: 30,
        memRamDisponibleMb: 1024,
        tempChip: 50,
        aiProcessorPct: 20,
        receivedAt: "2026-09-23T08:00:00.000Z",
    },
]

beforeEach(() => {
    mocks.push.mockReset()
})

describe("LineaProduccionView", () => {
    it("renderiza el selector de sector con el sector actual seleccionado", () => {
        render(
            <LineaProduccionView
                sectores={[sector(), sector({ id: "s-2", nombre: "Sector Sur" })]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={null}
                producto={null}
            />,
        )
        const select = screen.getByLabelText("Sector") as HTMLSelectElement
        expect(select.value).toBe("s-1")
    })

    it("navega a ?sector_id=... cuando el usuario cambia el selector", () => {
        render(
            <LineaProduccionView
                sectores={[sector(), sector({ id: "s-2", nombre: "Sector Sur" })]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={null}
                producto={null}
            />,
        )
        const select = screen.getByLabelText("Sector") as HTMLSelectElement
        fireEvent.change(select, { target: { value: "s-2" } })
        expect(mocks.push).toHaveBeenCalledWith("/linea-produccion?sector_id=s-2")
    })

    it("muestra el TelemetryDashboard cuando hay nodo ENTRADA_HORNO en el sector", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={null}
                producto={null}
            />,
        )
        const dash = screen.getByTestId("telemetry-dashboard")
        expect(dash.getAttribute("data-device")).toBe("node-1")
    })

    it("muestra empty state cuando no hay nodo ENTRADA_HORNO en el sector", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={null}
                history={[]}
                loteAbierto={null}
                producto={null}
            />,
        )
        expect(screen.queryByTestId("telemetry-dashboard")).toBeNull()
        expect(
            screen.getByText(/Este sector no tiene un nodo ENTRADA_HORNO/),
        ).toBeTruthy()
    })

    it("muestra el semáforo verde cuando el setpoint está dentro del rango", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={lote({ temp1_objetivo: 200 })}
                producto={producto({ tempMin: 180, tempMax: 220 })}
            />,
        )
        // 200°C dentro de [180, 220]: en rango
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("En rango")
    })

    it("muestra el semáforo en rojo cuando el setpoint sale del rango", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={lote({ temp1_objetivo: 250 })}
                producto={producto({ tempMin: 180, tempMax: 220 })}
            />,
        )
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("Fuera de rango")
    })

    it("muestra el nivel warning cuando el setpoint está a menos del 5% del borde", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                // Rango [180, 220] tiene span 40; 5% = 2. 219 está dentro del 5%
                // del borde superior => warning.
                loteAbierto={lote({ temp1_objetivo: 219 })}
                producto={producto({ tempMin: 180, tempMax: 220 })}
            />,
        )
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("En el borde")
    })

    it("se degrada con un mensaje neutro cuando no hay lote abierto", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={null}
                producto={producto()}
            />,
        )
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("No hay lote abierto")
    })

    it("se degrada con un mensaje neutro cuando el producto no está en el catálogo", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={lote({ producto_id: "p-404" })}
                producto={null}
            />,
        )
        const semaforo = screen.getByRole("region", { name: /Semáforo de tolerancia/i })
        expect(semaforo.textContent).toContain("Producto del lote sin catálogo")
    })

    it("incluye el rango del producto cuando hay producto configurado", () => {
        render(
            <LineaProduccionView
                sectores={[sector()]}
                selectedSectorId="s-1"
                entradaDevice={device()}
                history={sampleHistory}
                loteAbierto={null}
                producto={producto()}
            />,
        )
        expect(screen.getByText("Tostada")).toBeTruthy()
        expect(screen.getByText(/180 – 220 °C/)).toBeTruthy()
        expect(screen.getByText(/0,5 – 1,5 m\/s/)).toBeTruthy()
    })
})