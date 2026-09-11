"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import type { CreateDispositivoRequest, UpdateDispositivoRequest, Device, SpecificDevice } from "@/lib/devices-data";
import type { ProductionRun } from "@/lib/production-data";
import { parseDevicesPayload, parseProductionPayload } from "@/lib/monitoring-runtime";
import {
    type LotesPorProducto,
    type LoteProductivo,
    type ParametroProducto,
    type ParametroProductoRequest,
} from "@/lib/parametros-producto"
import { ApiError } from "@/lib/api-client"
import { collectPaginatedPages, parseBackendPage, type BackendPage } from "@/lib/pagination"

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
const SESSION_COOKIE = "session_token"

function getApiUrl(): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
    if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL no está definida. Crea un archivo .env.local con NEXT_PUBLIC_API_URL=https://tu-host")
    }
    return apiUrl
}

/** Forward the incoming browser session to the Go API from server actions. */
async function getSessionHeaders(): Promise<HeadersInit> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    return {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isSuccessfulArrayResponse<T>(
    value: unknown,
): value is Record<string, unknown> & { success: true; data: T[] } {
    return isRecord(value) && value.success === true && Array.isArray(value.data);
}

function getResponseMessage(value: unknown): string {
    return isRecord(value) && typeof value.message === "string" && value.message
        ? value.message
        : "Error desconocido del servidor";
}

function validatePageParams(page: number, pageSize: number): void {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new Error("Parámetros de paginación inválidos.")
    }
}

export async function getAllProductionRuns(): Promise<ProductionRun[]> {
    const apiUrl = getApiUrl()
    const collection = await collectPaginatedPages<ProductionRun>({
        pageSize: 100,
        getId: (run) => run.id,
        fetchPage: async (page): Promise<BackendPage<ProductionRun>> => {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 8000)
            try {
                const response = await fetch(`${apiUrl}/api/v1/lotes-productivos?page=${page}&pageSize=100`, {
                    headers: await getSessionHeaders(),
                    cache: "no-store",
                    signal: controller.signal,
                })

                if (response.status === 401) {
                    throw new ApiError(401, "Sesión expirada o no autenticado")
                }
                if (!response.ok) {
                    throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
                }

                const result: unknown = await response.json()
                const pageResult = parseBackendPage<ProductionRun>(result, {
                    requestedPage: page,
                    requestedPageSize: 100,
                    allowLegacyMetadata: true,
                })
                if (!pageResult) {
                    if (isRecord(result) && result.success === false) throw new Error(getResponseMessage(result))
                    throw new Error("La API devolvió una respuesta inválida para producción.")
                }
                const data = parseProductionPayload(pageResult.items)
                if (data === null) throw new Error("La API devolvió una respuesta inválida para producción.")
                return { ...pageResult, items: data }
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") {
                    throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Los datos de producción no están disponibles.")
                }
                throw e
            } finally {
                clearTimeout(timeout)
            }
        },
    })
    return collection.items
}

export async function getDevices() {
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/dispositivos`, {
            headers: await getSessionHeaders(),
            cache: "no-store",
            signal: controller.signal,
        });

        if (response.status === 401) {
            throw new ApiError(401, "Sesión expirada o no autenticado");
        }

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: unknown = await response.json();

        if (!isSuccessfulArrayResponse<Device>(result)) {
            if (isRecord(result) && result.success === false) {
                throw new Error(getResponseMessage(result));
            }
            throw new Error("La API devolvió una respuesta inválida para dispositivos.");
        }
        const data = parseDevicesPayload(result);
        if (data === null) {
            throw new Error("La API devolvió una respuesta inválida para dispositivos.");
        }
        return data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Los nodos no están disponibles.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

export async function getDeviceHistory(dispositivoId: string, page = 1, pageSize = 20): Promise<SpecificDevice[]> {
    return (await getDeviceHistoryPageInternal(dispositivoId, page, pageSize, true)).items
}

async function getDeviceHistoryPageInternal(
    dispositivoId: string,
    page: number,
    pageSize: number,
    allowLegacyMetadata: boolean,
): Promise<{ items: SpecificDevice[]; total: number; page: number; pageSize: number }> {
    validatePageParams(page, pageSize)
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(
            `${apiUrl}/api/v1/dispositivos/metricas?dispositivoId=${encodeURIComponent(dispositivoId)}&page=${page}&pageSize=${pageSize}`,
            {
                headers: await getSessionHeaders(),
                cache: "no-store",
                signal: controller.signal,
            },
        );

        if (response.status === 401) {
            throw new ApiError(401, "Sesión expirada o no autenticado");
        }

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: unknown = await response.json();

        const pageResult = parseBackendPage<SpecificDevice>(result, {
            requestedPage: page,
            requestedPageSize: pageSize,
            allowLegacyMetadata,
        })
        if (!pageResult) {
            if (isRecord(result) && result.success === false) {
                throw new Error(getResponseMessage(result));
            }
            throw new Error("La API devolvió una respuesta inválida para el historial del dispositivo.");
        }
        return {
            items: pageResult.items,
            total: pageResult.total ?? pageResult.items.length,
            page: pageResult.page,
            pageSize: pageResult.pageSize,
        }
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            console.warn("El backend no respondió a tiempo (¿Render en cold-start?). Historial no disponible.");
        } else {
            console.warn("No se pudo obtener el historial. Historial no disponible.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

/** Additive paginated history contract for the device detail consumer. */
export async function getDeviceHistoryPage(
    dispositivoId: string,
    page = 1,
    pageSize = 20,
): Promise<{ items: SpecificDevice[]; total: number; page: number; pageSize: number }> {
    return getDeviceHistoryPageInternal(dispositivoId, page, pageSize, false)
}


export async function getProductosConParametros(): Promise<ParametroProducto[]> {
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/parametros-producto`, {
            headers: await getSessionHeaders(),
            cache: "no-store",
            signal: controller.signal,
        });

        if (response.status === 401) {
            throw new ApiError(401, "Sesión expirada o no autenticado");
        }

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: unknown = await response.json();

        if (!isSuccessfulArrayResponse<ParametroProducto>(result)) {
            if (isRecord(result) && result.success === false) {
                throw new Error(getResponseMessage(result));
            }
            throw new Error("La API devolvió una respuesta inválida para los parámetros de producto.");
        }
        return result.data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Los parámetros de producto no están disponibles.");
        }
        throw e;
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
    validatePageParams(page, pageSize)
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(
            `${apiUrl}/api/v1/lotes-productivos?productoId=${encodeURIComponent(productoId)}&page=${page}&pageSize=${pageSize}`,
            {
                headers: await getSessionHeaders(),
                cache: "no-store",
                signal: controller.signal,
            },
        );

        if (response.status === 401) {
            throw new ApiError(401, "Sesión expirada o no autenticado");
        }

        if (!response.ok) {
            throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
        }

        const result: unknown = await response.json();

        const pageResult = parseBackendPage<LoteProductivo>(result, {
            requestedPage: page,
            requestedPageSize: pageSize,
        })
        if (!pageResult || pageResult.total === undefined) {
            if (isRecord(result) && result.success === false) {
                throw new Error(getResponseMessage(result));
            }
            throw new Error("La API devolvió una respuesta inválida para el historial del producto.");
        }

        return {
            items: pageResult.items,
            total: pageResult.total,
            page: pageResult.page,
            pageSize: pageResult.pageSize,
        };
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). El historial del producto no está disponible.");
        }
        throw e;
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
            headers: {
                "Content-Type": "application/json",
                ...(await getSessionHeaders()),
            },
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

// Registers a new Raspberry Pi node in the catalog (POST /api/v1/dispositivos).
// The backend generates the device UUID, which the Pi must later send as
// dispositivoId in its pings — the UI surfaces it after creation.

// Coerces the backend EstadoDispositivo payload of a freshly created node into
// the safe Device shape used by the UI.
function normalizeCreatedDispositivo(raw: unknown): Device | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const dispositivoId = typeof r.dispositivoId === "string" ? r.dispositivoId : ""
  if (!dispositivoId) return null

  return {
    dispositivoId,
    nombre: typeof r.nombre === "string" ? r.nombre : "Nodo",
    ubicacion: typeof r.ubicacion === "string" ? r.ubicacion : "—",
    estado: r.estado === "online" ? "online" : "offline",
    lastSeen: typeof r.lastSeen === "string" ? r.lastSeen : "",
  }
}

export async function createDispositivo(
    payload: CreateDispositivoRequest,
): Promise<{ ok: true; data: Device } | { ok: false; errors: string[] }> {
    if (!API_URL) {
        return { ok: false, errors: ["NEXT_PUBLIC_API_URL no está definida."] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/dispositivos`, {
            method: "POST",
            headers: await getSessionHeaders(),
            body: JSON.stringify(payload),
            cache: "no-store",
            signal: controller.signal,
        });

        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
            const data = normalizeCreatedDispositivo(result.data)
            if (!data) {
                return { ok: false, errors: ["La API devolvió un dispositivo sin identificador."] };
            }
            revalidatePath("/nodos");
            return { ok: true, data };
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

// Updates the name and location of an existing node (PUT /api/v1/dispositivos).
export async function updateDispositivo(
    payload: UpdateDispositivoRequest,
): Promise<{ ok: true; data: Device } | { ok: false; errors: string[] }> {
    if (!API_URL) {
        return { ok: false, errors: ["NEXT_PUBLIC_API_URL no está definida."] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/dispositivos`, {
            method: "PUT",
            headers: await getSessionHeaders(),
            body: JSON.stringify(payload),
            cache: "no-store",
            signal: controller.signal,
        });

        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
            const data = normalizeCreatedDispositivo(result.data)
            if (!data) {
                return { ok: false, errors: ["La API devolvió un dispositivo sin identificador."] };
            }
            revalidatePath("/nodos");
            return { ok: true, data };
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

// Removes a node from the catalog (DELETE /api/v1/dispositivos?dispositivoId=...).
export async function deleteDispositivo(
    dispositivoId: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
    if (!API_URL) {
        return { ok: false, errors: ["NEXT_PUBLIC_API_URL no está definida."] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}/api/v1/dispositivos?dispositivoId=${encodeURIComponent(dispositivoId)}`, {
            method: "DELETE",
            headers: await getSessionHeaders(),
            cache: "no-store",
            signal: controller.signal,
        });

        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
            revalidatePath("/nodos");
            return { ok: true };
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
