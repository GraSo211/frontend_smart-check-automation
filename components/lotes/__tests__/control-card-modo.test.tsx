// @vitest-environment jsdom

import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { LoteSector } from "@/lib/production-data"
import type { ModoOperacion } from "@/actions/api"
import { ControlCard } from "@/components/lotes/control-card"

const mocks = vi.hoisted(() => ({
    cambiarModo: vi.fn(),
    startControl: vi.fn(),
    stopControl: vi.fn(),
    aplicarConsigna: vi.fn(),
    getConsignaPropuesta: vi.fn(),
    getDecisiones: vi.fn(),
    getConfianzaClases: vi.fn(),
    updateControlParams: vi.fn(),
}))

vi.mock("@/actions/api", () => ({
    cambiarModo: mocks.cambiarModo,
    startControl: mocks.startControl,
    stopControl: mocks.stopControl,
    aplicarConsigna: mocks.aplicarConsigna,
    getConsignaPropuesta: mocks.getConsignaPropuesta,
    getDecisiones: mocks.getDecisiones,
    getConfianzaClases: mocks.getConfianzaClases,
    updateControlParams: mocks.updateControlParams,
}))

class FakeEventSource {
    static instances: FakeEventSource[] = []
    static readonly CLOSED = 2
    readonly CLOSED = 2
    readyState = 0
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    private listeners = new Map<string, Array<(event: MessageEvent) => void>>()
    close = vi.fn(() => {
        this.readyState = FakeEventSource.CLOSED
    })
    constructor(_url?: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
        FakeEventSource.instances.push(this)
    }
    addEventListener(type: string, handler: (event: MessageEvent) => void) {
        const list = this.listeners.get(type) ?? []
        list.push(handler)
        this.listeners.set(type, list)
    }
    emit(type: string, data: unknown) {
        for (const handler of this.listeners.get(type) ?? []) {
            handler({ data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent)
        }
    }
    open() {
        this.readyState = 1
        this.onopen?.()
    }
}

function lote(overrides: Partial<LoteSector> = {}): LoteSector {
    return {
        id: "l-1",
        sector_id: "s-1",
        estado: "ABIERTO",
        producto_id: "p-1",
        producto_nombre: "Pan",
        abierto_en: "2026-09-23T08:00:00.000Z",
        abierto_por: { device_id: "d-1", type: "ENTRADA_HORNO" },
        conteos: { ok: 90, crudo: 2, quemado: 8, total: 100 },
        ultimo_evento_en: "2026-09-23T09:00:00.000Z",
        inactividad_segundos: 12.5,
        cerrado_en: null,
        motivo_cierre: null,
        modo: "AUTOMATICO",
        ventana_evaluacion_segundos: 600,
        ventana_actualizacion_segundos: 300,
        tolerancia_temp_c: 2,
        umbral_aceptacion_quemado: 5,
        umbral_aceptacion_crudo: 5,
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
    mocks.getDecisiones.mockResolvedValue([])
    mocks.getConsignaPropuesta.mockResolvedValue(null)
    mocks.startControl.mockResolvedValue({ ok: true, data: { lote_id: "l-1", modo: "AUTOMATICO" } })
    mocks.stopControl.mockResolvedValue({ ok: true, data: { lote_id: "l-1", stopped: true } })
    mocks.aplicarConsigna.mockResolvedValue({ ok: true, data: { lote_id: "l-1", aprobada: true, aplicada: false } })
    mocks.cambiarModo.mockResolvedValue({
        ok: true,
        data: { lote_id: "l-1", modo: "AUTOMATICO" },
    })
    mocks.getConfianzaClases.mockResolvedValue([])
    mocks.updateControlParams.mockResolvedValue({ ok: true, data: { lote_id: "l-1" } })
})

describe("ControlCard · selector de modo", () => {
    it("muestra el selector con los tres modos cuando canControl es true", () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        const radiogroup = screen.getByRole("radiogroup", { name: "Modo de control" })
        expect(radiogroup).toBeTruthy()
        expect(screen.getByRole("radio", { name: "Manual" })).toBeTruthy()
        expect(screen.getByRole("radio", { name: "Supervisión" })).toBeTruthy()
        expect(screen.getByRole("radio", { name: "Automático" })).toBeTruthy()
        expect(screen.getByRole("radio", { name: "Automático" }).getAttribute("aria-checked")).toBe("true")
    })

    it("muestra el selector deshabilitado cuando canControl es false (rol Operario)", () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl={false} />)

        const manual = screen.getByRole("radio", { name: "Manual" }) as HTMLButtonElement
        expect(manual.disabled).toBe(true)
        // El texto del modo sigue siendo visible como fallback.
        expect(screen.getByText(/AUTOMATICO/i)).toBeTruthy()
    })

    it("aplica un cambio de modo SUPERVISION sin pedir confirmación", async () => {
        mocks.cambiarModo.mockResolvedValue({
            ok: true,
            data: { lote_id: "l-1", modo: "SUPERVISION" },
        })

        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await act(async () => {
            fireEvent.click(screen.getByRole("radio", { name: "Supervisión" }))
        })

        await waitFor(() => {
            expect(mocks.cambiarModo).toHaveBeenCalledWith("l-1", "SUPERVISION")
        })
        expect(screen.queryByRole("dialog", { name: /Pasar a modo MANUAL/i })).toBeNull()
    })

    it("pide confirmación al pasar a MANUAL desde un modo con loop", async () => {
        render(<ControlCard lote={lote({ modo: "SUPERVISION" })} canControl />)

        fireEvent.click(screen.getByRole("radio", { name: "Manual" }))

        const dialog = await screen.findByRole("dialog")
        expect(dialog.textContent).toContain("Pasar a modo MANUAL")
        expect(dialog.textContent).toContain("loop")
        // Todavía no se llamó la acción hasta confirmar.
        expect(mocks.cambiarModo).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole("button", { name: "Pasar a MANUAL" }))

        await waitFor(() => {
            expect(mocks.cambiarModo).toHaveBeenCalledWith("l-1", "MANUAL")
        })
    })

    it("cancela el cambio a MANUAL sin llamar a la acción", async () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        fireEvent.click(screen.getByRole("radio", { name: "Manual" }))
        await screen.findByRole("dialog")
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

        expect(mocks.cambiarModo).not.toHaveBeenCalled()
        // El modo visible sigue siendo el original.
        expect(screen.getByRole("radio", { name: "Automático" }).getAttribute("aria-checked")).toBe(
            "true",
        )
    })

    it("rollback optimista cuando la acción falla con 409", async () => {
        mocks.cambiarModo.mockResolvedValueOnce({
            ok: false,
            errors: ["Conflicto al cambiar el modo: hay un loop activo o el lote no admite el modo solicitado."],
        })

        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        fireEvent.click(screen.getByRole("radio", { name: "Supervisión" }))

        await waitFor(() => {
            expect(mocks.cambiarModo).toHaveBeenCalled()
        })

        await waitFor(() => {
            expect(
                screen.getByText(/No se pudo cambiar el modo/i).textContent,
            ).toContain("Conflicto")
        })
        // El modo volvió al original.
        expect(screen.getByRole("radio", { name: "Automático" }).getAttribute("aria-checked")).toBe(
            "true",
        )
    })

    it("sincroniza el modo cuando el SSE emite control.evento", async () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        // Espera a que el EventSource se monte y abra.
        await act(async () => {
            const stream = FakeEventSource.instances[0]
            stream?.open()
        })

        await act(async () => {
            const stream = FakeEventSource.instances[0]
            stream?.emit("control.evento", { lote_id: "l-1", modo: "SUPERVISION" })
        })

        expect(screen.getByRole("radio", { name: "Supervisión" }).getAttribute("aria-checked")).toBe(
            "true",
        )
    })

    it("ignora un control.evento con un modo inválido", async () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await act(async () => {
            const stream = FakeEventSource.instances[0]
            stream?.open()
            stream?.emit("control.evento", { lote_id: "l-1", modo: "NOPE" })
        })

        expect(screen.getByRole("radio", { name: "Automático" }).getAttribute("aria-checked")).toBe(
            "true",
        )
    })
})

// Helper de tipos: sólo verifica que ModoOperacion exporta el union correcto
// desde actions/api.ts, no tiene comportamiento runtime.
describe("ModoOperacion export type", () => {
    it("acepta MANUAL, SUPERVISION y AUTOMATICO", () => {
        const modes: ModoOperacion[] = ["MANUAL", "SUPERVISION", "AUTOMATICO"]
        expect(modes).toHaveLength(3)
    })
})

describe("ControlCard · confianza del modelo de visión (F-F8)", () => {
    it("consulta getConfianzaClases al montar con el id del lote y el límite 200", async () => {
        mocks.getConfianzaClases.mockResolvedValue([])

        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await waitFor(() => {
            expect(mocks.getConfianzaClases).toHaveBeenCalledWith("l-1", 200)
        })
    })

    it("muestra «sin muestras» cuando el endpoint devuelve un array vacío", async () => {
        mocks.getConfianzaClases.mockResolvedValue([])

        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await waitFor(() => {
            expect(screen.getByText(/Sin muestras suficientes/)).toBeTruthy()
        })
    })

    it("renderiza una barra por clase con su porcentaje, σ y conteo", async () => {
        mocks.getConfianzaClases.mockResolvedValue([
            { clase: "OK", confianza_media: 0.92, confianza_stddev: 0.04, muestras: 154 },
            { clase: "QUEMADO", confianza_media: 0.71, confianza_stddev: 0.12, muestras: 22 },
            { clase: "CRUDO", confianza_media: 0.45, confianza_stddev: null, muestras: 1 },
        ])

        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await waitFor(() => {
            expect(screen.getByText("92.0%")).toBeTruthy()
        })

        // Las 3 clases aparecen ordenadas alfabéticamente
        const section = screen.getByRole("region", { name: /Confianza del modelo de visión/i })
        const items = section.querySelectorAll("li")
        expect(items).toHaveLength(3)
        // La primera es CRUDO (45%), la segunda OK (92%), la tercera QUEMADO (71%).
        expect(items[0]!.textContent).toContain("CRUDO")
        expect(items[1]!.textContent).toContain("OK")
        expect(items[2]!.textContent).toContain("QUEMADO")

        // QUEMADO: σ 12% (confianza_stddev 0.12 -> 12)
        expect(screen.getByText(/σ ±12%/)).toBeTruthy()
        // CRUDO: σ null -> "1 muestra"
        expect(screen.getByText(/σ 1 muestra/)).toBeTruthy()
    })

    it("muestra el mensaje de error cuando el endpoint falla", async () => {
        mocks.getConfianzaClases.mockRejectedValueOnce(new Error("boom"))

        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await waitFor(() => {
            expect(screen.getByText(/No se pudo cargar la confianza del modelo: boom/)).toBeTruthy()
        })
    })
})

describe("ControlCard · parámetros del control", () => {
    it("muestra la sección en un lote ABIERTO con control habilitado y modo AUTOMATICO", () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        expect(screen.getByRole("region", { name: /Parámetros del control/i })).toBeTruthy()
        expect(screen.getByLabelText(/Tolerancia T/i)).toBeTruthy()
        expect(screen.getByRole("button", { name: /Guardar parámetros/i })).toBeTruthy()
    })

    it("oculta la sección en modo MANUAL", () => {
        render(<ControlCard lote={lote({ modo: "MANUAL" })} canControl />)

        expect(screen.queryByRole("region", { name: /Parámetros del control/i })).toBeNull()
    })

    it("oculta la sección cuando el usuario no puede controlar", () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl={false} />)

        expect(screen.queryByRole("region", { name: /Parámetros del control/i })).toBeNull()
    })

    it("envía sólo los campos cambiados", async () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        const tolerancia = screen.getByLabelText(/Tolerancia T/i) as HTMLInputElement
        const deltaTemp = screen.getByLabelText(/ΔT máx\/ciclo/i) as HTMLInputElement

        fireEvent.change(tolerancia, { target: { value: "3" } })
        fireEvent.change(deltaTemp, { target: { value: "4" } })

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /Guardar parámetros/i }))
        })

        await waitFor(() => {
            expect(mocks.updateControlParams).toHaveBeenCalledWith("l-1", {
                tolerancia_temp_c: 3,
                delta_temp1_max_c: 4,
            })
        })
    })

    it("no envía nada si los valores no cambiaron", async () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /Guardar parámetros/i }))
        })

        await waitFor(() => {
            expect(mocks.updateControlParams).not.toHaveBeenCalled()
        })
    })

    it("muestra un error inline cuando un valor está fuera de rango", async () => {
        render(<ControlCard lote={lote({ modo: "AUTOMATICO" })} canControl />)

        const tolerancia = screen.getByLabelText(/Tolerancia T/i) as HTMLInputElement
        fireEvent.change(tolerancia, { target: { value: "25" } })

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /Guardar parámetros/i }))
        })

        expect(screen.getByText(/Entre 0,01 y 20 °C/i)).toBeTruthy()
        expect(mocks.updateControlParams).not.toHaveBeenCalled()
    })
})

describe("ControlCard · propuesta pendiente en SUPERVISION", () => {
    const propuestaSSE = (autorizada: boolean) => ({
        lote_id: "l-1",
        autorizada,
        propuesta: { temp1: 200, velocidad: 1.5, z: 0.5 },
    })

    async function renderSupervision() {
        render(<ControlCard lote={lote({ modo: "SUPERVISION" })} canControl />)
        // Espera el pull inicial (resuelve null) para que no pise el SSE.
        await waitFor(() => expect(mocks.getConsignaPropuesta).toHaveBeenCalledWith("l-1"))
        await act(async () => {})
    }

    it("deshabilita el botón si no hay propuesta", async () => {
        await renderSupervision()

        const button = screen.getByRole("button", {
            name: "Aprobar propuesta pendiente",
        }) as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })

    it("habilita el botón y abre el modal con una propuesta sin autorizar", async () => {
        await renderSupervision()

        await act(async () => {
            FakeEventSource.instances[0]?.emit("control.propuesta", propuestaSSE(false))
        })

        const button = screen.getByRole("button", {
            name: "Aprobar propuesta pendiente",
        }) as HTMLButtonElement
        expect(button.disabled).toBe(false)
        expect(screen.getByText("Pendiente de aprobación")).toBeTruthy()

        await act(async () => {
            fireEvent.click(button)
        })

        const dialog = await screen.findByRole("dialog")
        expect(dialog.textContent).toContain("Aprobar propuesta del MPC")
    })

    it("mantiene el botón deshabilitado si la propuesta ya fue autorizada", async () => {
        await renderSupervision()

        await act(async () => {
            FakeEventSource.instances[0]?.emit("control.propuesta", propuestaSSE(true))
        })

        const button = screen.getByRole("button", {
            name: "Aprobar propuesta pendiente",
        }) as HTMLButtonElement
        expect(button.disabled).toBe(true)
        expect(
            screen.getByText("Aprobada: esperando que la Pi la aplique"),
        ).toBeTruthy()
    })

    it("limpia la propuesta cuando el pull devuelve null (204)", async () => {
        vi.useFakeTimers()
        try {
            render(<ControlCard lote={lote({ modo: "SUPERVISION" })} canControl />)
            // Flush del pull inicial (null) y del montaje del EventSource.
            await act(async () => {
                FakeEventSource.instances[0]?.open()
                await vi.advanceTimersByTimeAsync(0)
            })

            await act(async () => {
                FakeEventSource.instances[0]?.emit("control.propuesta", propuestaSSE(false))
            })

            const button = screen.getByRole("button", {
                name: "Aprobar propuesta pendiente",
            }) as HTMLButtonElement
            expect(button.disabled).toBe(false)

            // La Pi aplicó la propuesta: el endpoint ahora responde 204 → null.
            mocks.getConsignaPropuesta.mockResolvedValue(null)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000)
            })

            expect(button.disabled).toBe(true)
            expect(screen.getByText("Esperando propuesta del MPC")).toBeTruthy()
        } finally {
            vi.useRealTimers()
        }
    })
})
