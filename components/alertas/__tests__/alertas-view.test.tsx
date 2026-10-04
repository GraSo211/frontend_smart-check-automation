// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Alerta } from "@/lib/production-data"
import { AlertasView } from "@/components/alertas/alertas-view"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    ackAlerta: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/actions/api", () => ({
    ackAlerta: mocks.ackAlerta,
}))

function alerta(overrides: Partial<Alerta> = {}): Alerta {
    return {
        id: "a-1",
        sector_id: "s-1",
        lote_id: "l-1",
        tipo: "umbral_quemado",
        severidad: "CRITICAL",
        estado: "ACTIVA",
        mensaje: "Tasa de quemados supera el 5%",
        created_at: "2026-09-23T08:00:00.000Z",
        acked_por: null,
        acked_at: null,
        ...overrides,
    }
}

beforeEach(() => {
    mocks.push.mockReset()
    mocks.ackAlerta.mockReset()
})

describe("AlertasView", () => {
    it("muestra empty state cuando no hay alertas", () => {
        render(
            <AlertasView
                initialAlertas={[]}
                initialEstado="ACTIVA"
                error={null}
                canAck
            />,
        )
        expect(screen.getByText(/Sin alertas/)).toBeTruthy()
    })

    it("muestra el error cuando la carga falló", () => {
        render(
            <AlertasView
                initialAlertas={[]}
                initialEstado="ACTIVA"
                error="API caída"
                canAck
            />,
        )
        expect(screen.getByRole("alert").textContent).toContain("API caída")
    })

    it("navega con ?estado= cuando el usuario cambia el chip", () => {
        render(
            <AlertasView
                initialAlertas={[]}
                initialEstado="ACTIVA"
                error={null}
                canAck
            />,
        )
        fireEvent.click(screen.getByRole("tab", { name: "Reconocidas" }))
        // El router.push se llama dentro de un startTransition. Async funciona
        // bien en jsdom: el push queda registrado sincrónicamente porque
        // useTransition ya disparó la función antes del flush.
        expect(mocks.push).toHaveBeenCalledWith("/alertas?estado=ACK")
    })

    it("oculta el botón Reconocer cuando el rol es Operario", () => {
        render(
            <AlertasView
                initialAlertas={[alerta()]}
                initialEstado="ACTIVA"
                error={null}
                canAck={false}
            />,
        )
        expect(
            screen.queryByRole("button", { name: /Reconocer alerta/ }),
        ).toBeNull()
    })

    it("oculta el botón Reconocer cuando la alerta ya está en ACK", () => {
        render(
            <AlertasView
                initialAlertas={[alerta({ estado: "ACK", acked_por: { email: "s@f.com", nombre: "S" }, acked_at: "2026-09-23T08:15:00.000Z" })]}
                initialEstado="ACTIVA"
                error={null}
                canAck
            />,
        )
        expect(
            screen.queryByRole("button", { name: /Reconocer alerta/ }),
        ).toBeNull()
    })

    it("muestra el botón Reconocer y lo dispara via ackAlerta cuando hay permiso", async () => {
        mocks.ackAlerta.mockResolvedValue({
            ok: true,
            data: alerta({ estado: "ACK" }),
        })

        render(
            <AlertasView
                initialAlertas={[alerta()]}
                initialEstado="ACTIVA"
                error={null}
                canAck
            />,
        )

        const button = screen.getByRole("button", { name: /Reconocer alerta a-1/ })
        fireEvent.click(button)

        await waitFor(() => {
            expect(mocks.ackAlerta).toHaveBeenCalledWith("a-1")
        })
    })

    it("muestra el chip activo con el tab correcto seleccionado", () => {
        render(
            <AlertasView
                initialAlertas={[alerta()]}
                initialEstado="ACK"
                error={null}
                canAck
            />,
        )
        const tab = screen.getByRole("tab", { name: "Reconocidas" })
        expect(tab.getAttribute("aria-selected")).toBe("true")
    })

    it("muestra el badge de estado de cada alerta", () => {
        render(
            <AlertasView
                initialAlertas={[
                    alerta({ id: "a-1", estado: "ACTIVA" }),
                    alerta({ id: "a-2", estado: "ACK", acked_por: { email: "s@f.com", nombre: "S" }, acked_at: "2026-09-23T08:15:00.000Z" }),
                ]}
                initialEstado="TODAS"
                error={null}
                canAck
            />,
        )
        expect(screen.getAllByText("Activa")).toHaveLength(1)
        expect(screen.getAllByText("Reconocida")).toHaveLength(1)
    })
})