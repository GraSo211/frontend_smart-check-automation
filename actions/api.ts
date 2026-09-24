"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import type {
    Device,
    RegistrationApproval,
    RegistrationRejection,
    RegistrationRequest,
    SpecificDevice,
    UpdateDispositivoRequest,
} from "@/lib/devices-data";
import type { LoteSector, Producto, Sector, CreateSectorRequest, UpdateSectorRequest } from "@/lib/production-data";
import { parseDevice, parseDevicesPayload, parseLoteSectorPayload } from "@/lib/monitoring-runtime";
import {
    parseRegistrationApproval,
    parseRegistrationRejection,
    parseRegistrationRequests,
} from "@/lib/registration";
import {
    type ParametroProducto,
    type ParametroProductoRequest,
} from "@/lib/parametros-producto"
import { ApiError } from "@/lib/api-client"
import { parseBackendPage } from "@/lib/pagination"

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

function isSector(value: unknown): value is Sector {
    return isRecord(value) &&
        typeof value.id === "string" && value.id !== "" &&
        typeof value.nombre === "string" && value.nombre !== "";
}

function parseSector(data: unknown): Sector | null {
    return isSector(data) ? data : null;
}

function isProducto(value: unknown): value is Producto {
    return isRecord(value) &&
        typeof value.id === "string" && value.id !== "" &&
        typeof value.nombre === "string" && value.nombre !== "" &&
        typeof value.activo === "boolean";
}

export async function getSectores(): Promise<Sector[]> {
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/sectores`, {
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
        if (!isSuccessfulArrayResponse<Sector>(result) || !result.data.every(isSector)) {
            throw new Error("La API devolvió una respuesta inválida para sectores.");
        }
        return result.data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Los sectores no están disponibles.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

export async function getProductos(): Promise<Producto[]> {
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/productos`, {
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
        if (!isSuccessfulArrayResponse<Producto>(result) || !result.data.every(isProducto)) {
            throw new Error("La API devolvió una respuesta inválida para productos.");
        }
        return result.data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Los productos no están disponibles.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

// Historial del sector con paginación por cursor. Con OAuth, `sector_id` es
// obligatorio. El backend omite `siguiente_cursor` cuando no hay más páginas.
export async function getLotes(
    sectorId: string,
    opts?: { productoId?: string; limite?: number; antesDe?: string },
): Promise<{ items: LoteSector[]; total: number; siguienteCursor: string | null }> {
    const apiUrl = getApiUrl()
    const params = new URLSearchParams()
    params.set("sector_id", sectorId)
    if (opts?.productoId) params.set("producto_id", opts.productoId)
    const requestedLimite = opts?.limite ?? 20
    const limite = Math.min(100, Math.max(1, Math.trunc(requestedLimite)))
    params.set("limite", String(limite))
    if (opts?.antesDe) params.set("antes_de", opts.antesDe)

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/lotes?${params.toString()}`, {
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

        const payload: unknown = await response.json();
        if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) {
            throw new Error("La API devolvió una respuesta inválida para el historial de lotes.");
        }
        const items = parseLoteSectorPayload(payload);
        if (items === null) {
            throw new Error("La API devolvió una respuesta inválida para el historial de lotes.");
        }
        const total = isRecord(payload) && typeof payload.total === "number" && Number.isFinite(payload.total)
            ? payload.total
            : items.length;
        const cursor = payload.siguiente_cursor;
        const siguienteCursor = typeof cursor === "string" && cursor !== "" ? cursor : null;
        return { items, total, siguienteCursor };
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Los lotes no están disponibles.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

const MAX_SECTOR_PAGES = 20

/**
 * Historial global: itera los sectores EN PARALELO (cada sector mantiene su
 * propio bucle de cursor secuencial). Es atómico: si un sector falla o la
 * paginación no se puede completar, se descarta todo en vez de publicar una
 * colección parcial. Se preservan los errores de sesión (`ApiError`) y el
 * mensaje de timeout en lugar de enmascararlos con el genérico.
 */
export async function getAllLotes(): Promise<LoteSector[]> {
    const sectores = await getSectores()
    const byId = new Map<string, LoteSector>()
    try {
        await Promise.all(sectores.map(async (sector) => {
            let cursor: string | undefined
            for (let page = 0; page < MAX_SECTOR_PAGES; page += 1) {
                const result = await getLotes(sector.id, { limite: 100, antesDe: cursor })
                for (const lote of result.items) byId.set(lote.id, lote)
                if (!result.siguienteCursor) break
                cursor = result.siguienteCursor
            }
        }))
    } catch (e) {
        if (e instanceof ApiError) throw e
        if (e instanceof Error && (e.name === "AbortError" || e.message.includes("no respondió a tiempo"))) {
            throw e
        }
        throw new Error("Los lotes no están disponibles.")
    }
    return [...byId.values()]
}

// Lote abierto del sector, o null. La ausencia es 200 con `lote: null`.
export async function getLoteAbierto(sectorId: string): Promise<LoteSector | null> {
    const apiUrl = getApiUrl()
    const params = new URLSearchParams()
    params.set("sector_id", sectorId)

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/lotes/abierto?${params.toString()}`, {
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

        const payload: unknown = await response.json();
        if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
            throw new Error("La API devolvió una respuesta inválida para el lote abierto.");
        }
        if (payload.data.lote === null) return null;
        const lote = parseLoteSectorPayload([payload.data.lote])?.[0] ?? null;
        if (lote === null) {
            throw new Error("La API devolvió una respuesta inválida para el lote abierto.");
        }
        return lote;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). El lote abierto no está disponible.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
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

// ─── Catálogo de nodos: metadatos y ciclo de vida de credenciales ────────────
//
// La creación directa de dispositivos no existe (POST responde 405). El alta
// pasa por una solicitud de registro que la Raspberry envía y que un
// Supervisor/Admin aprueba o rechaza. La baja directa del catálogo
// (DELETE /api/v1/dispositivos) sí está disponible para Supervisor/Admin.
// Estas acciones mantienen al backend como autoridad: sólo traducen el envelope
// de error y revalidan la ruta /nodos.

export type DeviceActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; errors: string[]; code?: string };

// Códigos de error del backend traducidos a mensajes es-AR claros.
const DEVICE_ERROR_MESSAGES: Record<string, string> = {
    validation_error: "Revisá los datos ingresados.",
    device_not_found: "El dispositivo no existe.",
    human_auth_required: "Se requiere una sesión con rol Supervisor o Administrador.",
    unauthorized: "Sesión expirada o permisos insuficientes.",
    rate_limited: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.",
    internal_error: "Ocurrió un error interno en el servidor.",
};

// Fallbacks por HTTP status específicos de las solicitudes de registro.
const REGISTRATION_STATUS_MESSAGES: Record<number, string> = {
    404: "La solicitud de registro no existe.",
    409: "La solicitud de registro ya fue resuelta.",
    410: "La solicitud de registro expiró.",
};

// Normalizes the optional camera URL sent to the backend: trim, and drop an
// empty value so the field is omitted from the JSON body.
function normalizeWhepUrl(value: string | undefined): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
}

function errorCodeOf(result: unknown): string | null {
    if (!isRecord(result)) return null
    const errors = result.errors
    if (isRecord(errors) && typeof errors.code === "string" && errors.code) return errors.code
    return null
}

// The backend error envelope carries `errors:{code}`. Legacy endpoints may send
// an array of strings instead; both shapes are handled.
function errorsFromResponse(
    result: unknown,
    response: Response,
    statusMessages?: Record<number, string>,
): { errors: string[]; code?: string } {
    const code = errorCodeOf(result)
    if (code && DEVICE_ERROR_MESSAGES[code]) {
        return { errors: [DEVICE_ERROR_MESSAGES[code]], code }
    }
    const statusMessage = statusMessages?.[response.status]
    if (statusMessage) {
        return { errors: [statusMessage], ...(code ? { code } : {}) }
    }
    if (isRecord(result) && Array.isArray(result.errors)) {
        const list = result.errors.map(String).filter(Boolean)
        if (list.length > 0) return { errors: list, ...(code ? { code } : {}) }
    }
    if (isRecord(result) && typeof result.message === "string" && result.message) {
        return { errors: [result.message], ...(code ? { code } : {}) }
    }
    if (response.status === 401 || response.status === 403) {
        return { errors: [DEVICE_ERROR_MESSAGES.unauthorized], code: "unauthorized" }
    }
    if (response.status === 429) {
        return { errors: [DEVICE_ERROR_MESSAGES.rate_limited], code: "rate_limited" }
    }
    return {
        errors: [`La API respondió con ${response.status}: ${response.statusText}`],
        ...(code ? { code } : {}),
    }
}

interface DeviceMutationOptions<T> {
    path: string
    method: "POST" | "PUT" | "DELETE"
    body?: unknown
    parse: (data: unknown) => T | null
    invalidMessage: string
    /** Mensajes por HTTP status, específicos del endpoint (p. ej. solicitudes). */
    statusMessages?: Record<number, string>
    /** Rutas revalidadas tras un éxito. Por defecto `/nodos`. */
    revalidatePaths?: string[]
    /**
     * Endpoints cuyo éxito no devuelve `data` (p. ej. DELETE de un sector).
     * Cuando es `true` no se exige un payload parseable.
     */
    allowEmptyData?: boolean
}

// Shared POST/PUT/DELETE helper: cookie-forwarded, no-store, 8s timeout,
// revalidates the configured routes on success and translates the error
// envelope. DELETE requests never carry a body.
async function deviceMutation<T>(options: DeviceMutationOptions<T>): Promise<DeviceActionResult<T>> {
    if (!API_URL) {
        return { ok: false, errors: ["NEXT_PUBLIC_API_URL no está definida."] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${API_URL}${options.path}`, {
            method: options.method,
            headers: await getSessionHeaders(),
            ...(options.method === "DELETE" ? {} : { body: JSON.stringify(options.body ?? {}) }),
            cache: "no-store",
            signal: controller.signal,
        });

        const result: unknown = await response.json().catch(() => null);

        if (response.ok && isRecord(result) && result.success === true) {
            if (options.allowEmptyData) {
                for (const path of options.revalidatePaths ?? ["/nodos"]) revalidatePath(path);
                return { ok: true, data: null as T };
            }
            const data = options.parse(result.data);
            if (data === null) return { ok: false, errors: [options.invalidMessage] };
            for (const path of options.revalidatePaths ?? ["/nodos"]) revalidatePath(path);
            return { ok: true, data };
        }

        return { ok: false, ...errorsFromResponse(result, response, options.statusMessages) };
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            return { ok: false, errors: ["El backend no respondió a tiempo (¿Render en cold-start?)."] };
        }
        return { ok: false, errors: [e instanceof Error ? e.message : "Error desconocido"] };
    } finally {
        clearTimeout(timeout);
    }
}

// Solicitudes de registro de dispositivos (lectura: sólo Supervisor/Admin;
// el backend responde 401/403 si el rol no alcanza).
export async function getRegistrationRequests(): Promise<RegistrationRequest[]> {
    const apiUrl = getApiUrl();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/registration-requests`, {
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
        const data = parseRegistrationRequests(result);
        if (data === null) {
            if (isRecord(result) && result.success === false) {
                throw new Error(getResponseMessage(result));
            }
            throw new Error("La API devolvió una respuesta inválida para las solicitudes de registro.");
        }
        return data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Las solicitudes de registro no están disponibles.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

// Aprueba una solicitud de registro. El backend responde en snake_case
// (`request_id`, `device_id`) y se normaliza al contrato camelCase.
export async function approveRegistrationRequest(
    requestId: string,
): Promise<DeviceActionResult<RegistrationApproval>> {
    return deviceMutation<RegistrationApproval>({
        path: `/api/v1/registration-requests/${encodeURIComponent(requestId)}/approve`,
        method: "POST",
        parse: parseRegistrationApproval,
        invalidMessage: "La API devolvió una aprobación de registro inválida.",
        statusMessages: REGISTRATION_STATUS_MESSAGES,
    });
}

// Rechaza una solicitud de registro. El backend responde en camelCase.
export async function rejectRegistrationRequest(
    requestId: string,
): Promise<DeviceActionResult<RegistrationRejection>> {
    return deviceMutation<RegistrationRejection>({
        path: `/api/v1/registration-requests/${encodeURIComponent(requestId)}/reject`,
        method: "POST",
        parse: parseRegistrationRejection,
        invalidMessage: "La API devolvió un rechazo de registro inválido.",
        statusMessages: REGISTRATION_STATUS_MESSAGES,
    });
}

// Updates the sector and camera (WHEP) URL of an existing node
// (PUT /api/v1/dispositivos). The name is immutable from the panel: only the
// device itself can change it through its authenticated endpoint, so the
// backend rejects requests carrying `nombre` with a 400. A 409 means the sector
// already has a node with that functional role (max 1 ENTRADA_HORNO and 1
// SALIDA_HORNO per sector).
export async function updateDispositivo(
    payload: UpdateDispositivoRequest,
): Promise<DeviceActionResult<Device>> {
    return deviceMutation<Device>({
        path: "/api/v1/dispositivos",
        method: "PUT",
        body: { ...payload, whepUrl: normalizeWhepUrl(payload.whepUrl) },
        parse: parseDevice,
        invalidMessage: "La API devolvió un dispositivo inválido.",
        statusMessages: {
            409: "El sector ya tiene un nodo con ese rol (entrada o salida).",
        },
    });
}

// Deletes a node from the catalog
// (DELETE /api/v1/dispositivos?dispositivoId=...). The backend performs a soft
// delete: it revokes the node credential, unassigns its sector and keeps the
// telemetry history. The node must register again.
export async function deleteDispositivo(
    dispositivoId: string,
): Promise<DeviceActionResult<null>> {
    return deviceMutation<null>({
        path: `/api/v1/dispositivos?dispositivoId=${encodeURIComponent(dispositivoId)}`,
        method: "DELETE",
        parse: () => null,
        allowEmptyData: true,
        invalidMessage: "La API devolvió una respuesta inválida al eliminar el dispositivo.",
        statusMessages: {
            404: "El dispositivo no existe.",
        },
    });
}

// ─── Catálogo de sectores ────────────────────────────────────────────────────
//
// Sectores (misma entidad que los lotes) reemplazan la antigua `ubicacion` de
// los dispositivos. Las escrituras requieren rol Supervisor/Admin y revalidan
// las vistas que consumen el catálogo.

const SECTOR_STATUS_MESSAGES: Record<number, string> = {
    409: "El sector tiene lotes asociados y no se puede eliminar.",
};

const SECTOR_REVALIDATE_PATHS = ["/sectores", "/configuracion"];

// Creates a sector (POST /api/v1/sectores).
export async function createSector(
    input: CreateSectorRequest,
): Promise<DeviceActionResult<Sector>> {
    return deviceMutation<Sector>({
        path: "/api/v1/sectores",
        method: "POST",
        body: { nombre: input.nombre },
        parse: parseSector,
        invalidMessage: "La API devolvió un sector inválido.",
        revalidatePaths: SECTOR_REVALIDATE_PATHS,
    });
}

// Renames a sector (PUT /api/v1/sectores/{id}).
export async function updateSector(
    input: UpdateSectorRequest,
): Promise<DeviceActionResult<Sector>> {
    return deviceMutation<Sector>({
        path: `/api/v1/sectores/${encodeURIComponent(input.id)}`,
        method: "PUT",
        body: { nombre: input.nombre },
        parse: parseSector,
        invalidMessage: "La API devolvió un sector inválido.",
        statusMessages: {
            404: "El sector no existe.",
        },
        revalidatePaths: SECTOR_REVALIDATE_PATHS,
    });
}

// Deletes a sector (DELETE /api/v1/sectores/{id}). A 409 means it still has
// lotes associated.
export async function deleteSector(id: string): Promise<DeviceActionResult<null>> {
    return deviceMutation<null>({
        path: `/api/v1/sectores/${encodeURIComponent(id)}`,
        method: "DELETE",
        parse: () => null,
        allowEmptyData: true,
        invalidMessage: "La API devolvió una respuesta inválida al eliminar el sector.",
        statusMessages: SECTOR_STATUS_MESSAGES,
        revalidatePaths: SECTOR_REVALIDATE_PATHS,
    });
}
