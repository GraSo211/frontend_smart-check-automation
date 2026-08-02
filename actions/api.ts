import { DeviceResponse, type SpecificDevice, type DeviceHistoryResponse } from "@/lib/devices-data";
import { getDeviceHistoryPage } from "@/lib/devices-data";
import type { ProductionRun, ProductionResponse } from "@/lib/production-data";

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
        console.log("Resultado de la API:", result.data);
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
            `${API_URL}/api/v1/dispositivos/${encodeURIComponent(dispositivoId)}/metricas?page=${page}&pageSize=${pageSize}`,
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
