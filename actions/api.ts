"use server"

import { revalidatePath } from "next/cache"
import { DeviceResponse, type SpecificDevice, type DeviceHistoryResponse } from "@/lib/devices-data";
import { getDeviceHistoryPage } from "@/lib/devices-data";
import type { ProductionRun, ProductionResponse } from "@/lib/production-data";
import {
    PARAMETROS_PRODUCTOS_MOCK,
    getLotesMockPorProducto,
    type LotesPorProducto,
    type LoteProductivo,
    type ParametroProducto,
    type ParametroProductoRequest,
} from "@/lib/parametros-producto";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getAllProductionRuns(): Promise<ProductionRun[]> {
    if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL no está definida. Crea un archivo .env.local con NEXT_PUBLIC_API_URL=https://tu-host");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/lotes-productivos?page=1&pageSize=100`, {
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: ProductionResponse = await response.json();

        if (!result.success) {
            throw new Error(result.message ?? "Error desconocido del servidor");
        }
        console.log("Resultado de la API:", result.data.items);
        return result.data.items;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Se usan datos de muestra.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

export async function getDevices() {
    if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL no está definida. Crea un archivo .env.local con NEXT_PUBLIC_API_URL=https://tu-host");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/dispositivos`, {
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: DeviceResponse = await response.json();

        if (!result.success) {
            throw new Error(result.message ?? "Error desconocido del servidor");
        }
        console.log("Resultado de la API:", result);
        return result.data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Se usan datos de muestra.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

export async function getDeviceHistory(dispositivoId: string, page = 1, pageSize = 20): Promise<SpecificDevice[]> {
    if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL no está definida. Crea un archivo .env.local con NEXT_PUBLIC_API_URL=https://tu-host");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(
            `${API_URL}/api/v1/dispositivos/metricas?dispositivoId=${dispositivoId}&page=${page}&pageSize=${pageSize}`,
            {
                cache: "no-store",
                signal: controller.signal,
            },
        );

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: DeviceHistoryResponse = await response.json();

        if (!result.success) {
            throw new Error(result.message ?? "Error desconocido del servidor");
        }
        console.log("Historial del dispositivo:", result.data);
        return result.data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            console.warn("El backend no respondió a tiempo (¿Render en cold-start?). Se usan datos de muestra.");
        } else {
            console.warn("No se pudo obtener el historial. Se usan datos de muestra.");
        }
        return getDeviceHistoryPage(dispositivoId, page, pageSize).data;
    } finally {
        clearTimeout(timeout);
    }
}


export async function getProductosConParametros(): Promise<ParametroProducto[]> {
    if (!API_URL) {
        return PARAMETROS_PRODUCTOS_MOCK;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/parametros-producto`, {
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message ?? "Error desconocido del servidor");
        }
        // The backend sends the array directly under `data` (no .items wrapper).
        return Array.isArray(result.data) ? (result.data as ParametroProducto[]) : [];
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            console.warn("El backend no respondió a tiempo (¿Render en cold-start?). Se usan datos de muestra.");
        } else {
            console.warn("No se pudieron obtener los parámetros. Se usan datos de muestra.");
        }
        return PARAMETROS_PRODUCTOS_MOCK;
    } finally {
        clearTimeout(timeout);
    }
}

// Per-product batch-run history. Only the horno/cinta fields are surfaced by
// the UI; this returns the raw rows so the table can decide what to render.
export async function getLotesPorProducto(
    productoId: string,
    page = 1,
    pageSize = 20,
): Promise<LotesPorProducto> {
    if (!API_URL) {
        return getLotesMockPorProducto(productoId, page, pageSize);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(
            `${API_URL}/api/v1/lotes-productivos?productoId=${productoId}&page=${page}&pageSize=${pageSize}`,
            {
                cache: "no-store",
                signal: controller.signal,
            },
        );

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message ?? "Error desconocido del servidor");
        }

        const items = Array.isArray(result.data) ? (result.data as LoteProductivo[]) : [];
        return {
            items,
            total: typeof result.total === "number" ? result.total : items.length,
            page,
            pageSize,
        };
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            console.warn("El backend no respondió a tiempo (¿Render en cold-start?). Se usan datos de muestra.");
        } else {
            console.warn("No se pudo obtener el historial. Se usan datos de muestra.");
        }
        return getLotesMockPorProducto(productoId, page, pageSize);
    } finally {
        clearTimeout(timeout);
    }
}

// Updates the recommended parameters of an existing product (PUT).
export async function updateParametrosProducto(
    payload: ParametroProductoRequest,
): Promise<{ ok: true; data: ParametroProducto } | { ok: false; errors: string[] }> {
    if (!API_URL) {
        return { ok: false, errors: ["NEXT_PUBLIC_API_URL no está definida."] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/parametros-producto`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
            signal: controller.signal,
        });

        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
            revalidatePath("/configuracion");
            return { ok: true, data: result.data as ParametroProducto };
        }

        const errors =
            Array.isArray(result?.errors) && result.errors.length > 0
                ? result.errors.map(String)
                : [result?.message ?? `La API respondió con ${response.status}: ${response.statusText}`];
        return { ok: false, errors };
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            return { ok: false, errors: ["El backend no respondió a tiempo (¿Render en cold-start?)."] };
        }
        return { ok: false, errors: [e instanceof Error ? e.message : "Error desconocido"] };
    } finally {
        clearTimeout(timeout);
    }
}
