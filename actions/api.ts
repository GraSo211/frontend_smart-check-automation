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
import type {
    LoteSector,
    Sector,
    CreateSectorRequest,
    UpdateSectorRequest,
    Producto,
    ProductoRequest,
    DecisionControl,
    MetricaHorno,
    PrediccionResumen,
    SetpointPropuesto,
    ControlEstado,
    ConfianzaClase,
    Alerta,
    ControlLimites,
} from "@/lib/production-data";
import { parseDevice, parseDevicesPayload, parseLoteSectorPayload } from "@/lib/monitoring-runtime";
import {
    parseRegistrationApproval,
    parseRegistrationRejection,
    parseRegistrationRequests,
} from "@/lib/registration";
import { ApiError } from "@/lib/api-client"
import { parseBackendPage } from "@/lib/pagination"
import { isRecord } from "@/lib/is-record"

const SESSION_COOKIE = "session_token"

function getApiUrl(): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
    if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL no está definida. Crea un archivo .env.local con NEXT_PUBLIC_API_URL=https://tu-host")
    }
    return apiUrl
}

// Non-throwing base URL resolution for the mutation helpers, which translate a
// missing configuration into an `{ ok: false }` result instead of throwing.
function getApiUrlOrNull(): string | null {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || null
}

/** Forward the incoming browser session to the Go API from server actions. */
async function getSessionHeaders(): Promise<HeadersInit> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    return {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
    }
}

/**
 * Shared read scaffolding for the backend GET actions: resolves the base URL at
 * call time, applies the 8s abort timeout and the 401 translation, then defers
 * the endpoint-specific `!response.ok` check and payload parsing to `handle`.
 */
async function withBackendFetch<T>(options: {
    path: string
    timeoutMessage: string
    handle: (response: Response) => Promise<T>
}): Promise<T> {
    const apiUrl = getApiUrl()

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}${options.path}`, {
            headers: await getSessionHeaders(),
            cache: "no-store",
            signal: controller.signal,
        });

        if (response.status === 401) {
            throw new ApiError(401, "Sesión expirada o no autenticado");
        }
        return options.handle(response)
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error(options.timeoutMessage);
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
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
        typeof value.activo === "boolean" &&
        typeof value.pesoReferenciaKg === "number" &&
        typeof value.toleranciaPesoPct === "number" &&
        typeof value.dimensionBaseCm === "number" &&
        typeof value.toleranciaDimensionCm === "number" &&
        typeof value.tempMin === "number" &&
        typeof value.tempMax === "number" &&
        typeof value.velocidadCintaMin === "number" &&
        typeof value.velocidadCintaMax === "number";
}

function parseProducto(data: unknown): Producto | null {
    return isProducto(data) ? data : null;
}

export async function getSectores(): Promise<Sector[]> {
    return withBackendFetch({
        path: "/api/v1/sectores",
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). Los sectores no están disponibles.",
        handle: async (response) => {
            if (!response.ok) {
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
            }

            const result: unknown = await response.json();
            if (!isSuccessfulArrayResponse<Sector>(result) || !result.data.every(isSector)) {
                throw new Error("La API devolvió una respuesta inválida para sectores.");
            }
            return result.data;
        },
    })
}

// Historial del sector con paginación por cursor. Con OAuth, `sector_id` es
// obligatorio. El backend omite `siguiente_cursor` cuando no hay más páginas.
export async function getLotes(
    sectorId: string,
    opts?: { productoId?: string; limite?: number; antesDe?: string },
): Promise<{ items: LoteSector[]; total: number; siguienteCursor: string | null }> {
    const params = new URLSearchParams()
    params.set("sector_id", sectorId)
    if (opts?.productoId) params.set("producto_id", opts.productoId)
    const requestedLimite = opts?.limite ?? 20
    const limite = Math.min(100, Math.max(1, Math.trunc(requestedLimite)))
    params.set("limite", String(limite))
    if (opts?.antesDe) params.set("antes_de", opts.antesDe)

    return withBackendFetch({
        path: `/api/v1/lotes?${params.toString()}`,
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). Los lotes no están disponibles.",
        handle: async (response) => {
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
        },
    })
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
    const params = new URLSearchParams()
    params.set("sector_id", sectorId)

    return withBackendFetch({
        path: `/api/v1/lotes/abierto?${params.toString()}`,
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). El lote abierto no está disponible.",
        handle: async (response) => {
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
        },
    })
}

export async function getDevices() {
    return withBackendFetch({
        path: "/api/v1/dispositivos",
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). Los dispositivos no están disponibles.",
        handle: async (response) => {
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
        },
    })
}

async function getDeviceHistoryPageInternal(
    dispositivoId: string,
    page: number,
    pageSize: number,
    allowLegacyMetadata: boolean,
): Promise<{ items: SpecificDevice[]; total: number; page: number; pageSize: number }> {
    validatePageParams(page, pageSize)
    return withBackendFetch({
        path: `/api/v1/dispositivos/metricas?dispositivoId=${encodeURIComponent(dispositivoId)}&page=${page}&pageSize=${pageSize}`,
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). Historial no disponible.",
        handle: async (response) => {
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
        },
    })
}

/** Additive paginated history contract for the device detail consumer. */
export async function getDeviceHistoryPage(
    dispositivoId: string,
    page = 1,
    pageSize = 20,
): Promise<{ items: SpecificDevice[]; total: number; page: number; pageSize: number }> {
    return getDeviceHistoryPageInternal(dispositivoId, page, pageSize, false)
}


// ─── Catálogo de productos ───────────────────────────────────────────────────
//
// El backend unificó `productos` y `parametros_producto` en una sola entidad:
// los parámetros de control viajan dentro de `Producto` y las escrituras
// requieren rol Supervisor/Admin. La baja es un soft delete (`activo=false`).

const PRODUCTO_STATUS_MESSAGES: Record<number, string> = {
    409: "Ya existe un producto con ese nombre",
    404: "El producto no existe",
    403: "Se requiere rol Supervisor o Administrador",
    401: "Sesión expirada o no autenticado",
};

const PRODUCTO_REVALIDATE_PATHS = ["/configuracion"];

export async function getProductos(): Promise<Producto[]> {
    return withBackendFetch({
        path: "/api/v1/productos",
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). Los productos no están disponibles.",
        handle: async (response) => {
            if (!response.ok) {
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`);
            }

            const result: unknown = await response.json();

            if (!isSuccessfulArrayResponse<Producto>(result) || !result.data.every(isProducto)) {
                if (isRecord(result) && result.success === false) {
                    throw new Error(getResponseMessage(result));
                }
                throw new Error("La API devolvió una respuesta inválida para productos.");
            }
            return result.data;
        },
    })
}

// Creates a product (POST /api/v1/productos).
export async function createProducto(
    request: ProductoRequest,
): Promise<DeviceActionResult<Producto>> {
    return deviceMutation<Producto>({
        path: "/api/v1/productos",
        method: "POST",
        body: request,
        parse: parseProducto,
        invalidMessage: "La API devolvió un producto inválido.",
        statusMessages: PRODUCTO_STATUS_MESSAGES,
        revalidatePaths: PRODUCTO_REVALIDATE_PATHS,
    });
}

// Full replacement of a product and its control parameters (PUT).
export async function updateProducto(
    id: string,
    request: ProductoRequest,
): Promise<DeviceActionResult<Producto>> {
    return deviceMutation<Producto>({
        path: `/api/v1/productos/${encodeURIComponent(id)}`,
        method: "PUT",
        body: request,
        parse: parseProducto,
        invalidMessage: "La API devolvió un producto inválido.",
        statusMessages: PRODUCTO_STATUS_MESSAGES,
        revalidatePaths: PRODUCTO_REVALIDATE_PATHS,
    });
}

// Soft-deletes a product (DELETE /api/v1/productos/{id}); the backend flips
// `activo` to false. The success envelope may omit `data`.
export async function deleteProducto(id: string): Promise<DeviceActionResult<null>> {
    return deviceMutation<null>({
        path: `/api/v1/productos/${encodeURIComponent(id)}`,
        method: "DELETE",
        parse: () => null,
        allowEmptyData: true,
        invalidMessage: "La API devolvió una respuesta inválida al desactivar el producto.",
        statusMessages: PRODUCTO_STATUS_MESSAGES,
        revalidatePaths: PRODUCTO_REVALIDATE_PATHS,
    });
}

// ─── Catálogo de dispositivos: metadatos y ciclo de vida de credenciales ────────────
//
// La creación directa de dispositivos no existe (POST responde 405). El alta
// pasa por una solicitud de registro que la Raspberry envía y que un
// Supervisor/Admin aprueba o rechaza. La baja directa del catálogo
// (DELETE /api/v1/dispositivos) sí está disponible para Supervisor/Admin.
// Estas acciones mantienen al backend como autoridad: sólo traducen el envelope
// de error y revalidan la ruta /dispositivos.

export type DeviceActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; errors: string[]; code?: string; fieldErrors?: Record<string, string> };

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

function errorCodeOf(result: unknown): string | null {
    if (!isRecord(result)) return null
    const errors = result.errors
    if (isRecord(errors) && typeof errors.code === "string" && errors.code) return errors.code
    return null
}

// Validaciones con errores por campo (`errors` como objeto `{ campo: mensaje }`).
// Se excluye `code` para no confundir el identificador semántico con un mensaje
// de campo. Devuelve `undefined` cuando no hay ningún campo con error.
function extractFieldErrors(result: unknown): Record<string, string> | undefined {
    if (!isRecord(result) || !isRecord(result.errors)) return undefined
    const entries = Object.entries(result.errors)
        .filter(([key]) => key !== "code")
        .map(([key, value]) => [key, typeof value === "string" ? value : String(value)] as const)
        .filter(([, message]) => message !== "")
    if (entries.length === 0) return undefined
    return Object.fromEntries(entries)
}

// The backend error envelope carries `errors:{code}`. Legacy endpoints may send
// an array of strings or a single string instead; all shapes are handled.
function errorsFromResponse(
    result: unknown,
    response: Response,
    statusMessages?: Record<number, string>,
): { errors: string[]; code?: string; fieldErrors?: Record<string, string> } {
    const code = errorCodeOf(result)
    // Errores de validación por campo (422): tienen prioridad y se exponen
    // también como `fieldErrors` para que el formulario los muestre inline.
    const fieldErrors = extractFieldErrors(result)
    if (fieldErrors) {
        return { errors: Object.values(fieldErrors), fieldErrors, ...(code ? { code } : {}) }
    }
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
    // Fallback del handler cuando el body JSON está malformado: `errors` es un
    // string con `err.Error()`.
    if (isRecord(result) && typeof result.errors === "string" && result.errors) {
        return { errors: [result.errors], ...(code ? { code } : {}) }
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
    method: "POST" | "PUT" | "PATCH" | "DELETE"
    body?: unknown
    parse: (data: unknown) => T | null
    invalidMessage: string
    /** Mensajes por HTTP status, específicos del endpoint (p. ej. solicitudes). */
    statusMessages?: Record<number, string>
    /** Rutas revalidadas tras un éxito. Por defecto `/dispositivos`. */
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
    const apiUrl = getApiUrlOrNull()
    if (!apiUrl) {
        return { ok: false, errors: ["NEXT_PUBLIC_API_URL no está definida."] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}${options.path}`, {
            method: options.method,
            headers: await getSessionHeaders(),
            ...(options.method === "DELETE" ? {} : { body: JSON.stringify(options.body ?? {}) }),
            cache: "no-store",
            signal: controller.signal,
        });

        const result: unknown = await response.json().catch(() => null);

        if (response.ok && isRecord(result) && result.success === true) {
            if (options.allowEmptyData) {
                for (const path of options.revalidatePaths ?? ["/dispositivos"]) revalidatePath(path);
                return { ok: true, data: null as T };
            }
            const data = options.parse(result.data);
            if (data === null) return { ok: false, errors: [options.invalidMessage] };
            for (const path of options.revalidatePaths ?? ["/dispositivos"]) revalidatePath(path);
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
    return withBackendFetch({
        path: "/api/v1/registration-requests",
        timeoutMessage: "El backend no respondió a tiempo (¿Render en cold-start?). Las solicitudes de registro no están disponibles.",
        handle: async (response) => {
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
        },
    })
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

// Updates the sector of an existing node (PUT /api/v1/dispositivos). The name
// is immutable from the panel: only the device itself can change it through
// its authenticated endpoint, so the backend rejects requests carrying
// `nombre` with a 400. A 409 means the sector already has a node with that
// functional role (max 1 ENTRADA_HORNO and 1 SALIDA_HORNO per sector).
export async function updateDispositivo(
    payload: UpdateDispositivoRequest,
): Promise<DeviceActionResult<Device>> {
    return deviceMutation<Device>({
        path: "/api/v1/dispositivos",
        method: "PUT",
        body: payload,
        parse: parseDevice,
        invalidMessage: "La API devolvió un dispositivo inválido.",
        statusMessages: {
            409: "El sector ya tiene un dispositivo con ese rol (entrada o salida).",
        },
    });
}

// Renames a node from the operator panel
// (PUT /api/v1/dispositivos/{id}/nombre). Requires Supervisor/Admin and a JWT
// cookie; the path id identifies the device (no id is sent in the body). The
// Raspberry Pi can also rename itself via its bearer-protected endpoint
// (/api/v1/dispositivos/nombre).
export async function renameDispositivo(
    dispositivoId: string,
    nombre: string,
): Promise<DeviceActionResult<Device>> {
    const trimmed = nombre.trim();
    if (!trimmed) {
        return { ok: false, errors: ["El nombre es requerido."] };
    }
    return deviceMutation<Device>({
        path: `/api/v1/dispositivos/${encodeURIComponent(dispositivoId)}/nombre`,
        method: "PUT",
        body: { nombre: trimmed },
        parse: parseDevice,
        invalidMessage: "La API devolvió un dispositivo inválido al renombrar.",
        statusMessages: {
            404: "El dispositivo no existe.",
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

// SCA-400 — control automático / supervisión -----------------------

/** Inicia el loop de control para un lote (modo AUTOMATICO o SUPERVISION). */
export async function startControl(
    loteId: string,
): Promise<DeviceActionResult<{ lote_id: string; modo: string }>> {
    return deviceMutation<{ lote_id: string; modo: string }>({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/control/start`,
        method: "POST",
        parse: (raw) => {
            if (!isRecord(raw)) return { lote_id: loteId, modo: "" }
            return {
                lote_id: String(raw.lote_id ?? loteId),
                modo: String(raw.modo ?? ""),
            }
        },
        allowEmptyData: true,
        invalidMessage: "La API devolvió una respuesta inválida al iniciar el control.",
        statusMessages: {
            404: "El lote no existe.",
            409: "El lote no está abierto o está en modo MANUAL.",
            422: "El producto del lote no existe en el catálogo.",
        },
        revalidatePaths: ["/lotes", "/supervision"],
    });
}

/** Detiene el loop de control para un lote. */
export async function stopControl(
    loteId: string,
): Promise<DeviceActionResult<{ lote_id: string; stopped: boolean }>> {
    return deviceMutation<{ lote_id: string; stopped: boolean }>({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/control/stop`,
        method: "POST",
        parse: (raw) => {
            if (!isRecord(raw)) return { lote_id: loteId, stopped: false }
            return {
                lote_id: String(raw.lote_id ?? loteId),
                stopped: Boolean(raw.stopped ?? false),
            }
        },
        allowEmptyData: true,
        invalidMessage: "La API devolvió una respuesta inválida al detener el control.",
        statusMessages: {
            404: "El lote no existe.",
        },
        revalidatePaths: ["/lotes", "/supervision"],
    });
}

/** Aprueba la propuesta pendiente en modo SUPERVISION. */
export async function aplicarConsigna(
    loteId: string,
    decisionId?: string,
): Promise<DeviceActionResult<{
    lote_id: string
    aprobada: boolean
    aplicada: boolean
    decision_id?: string
    temp1_objetivo?: number
    vel_objetivo?: number
}>> {
    return deviceMutation<{
        lote_id: string
        aprobada: boolean
        aplicada: boolean
        decision_id?: string
        temp1_objetivo?: number
        vel_objetivo?: number
    }>({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/aplicar-consigna`,
        method: "POST",
        body: decisionId ? { decision_id: decisionId } : undefined,
        parse: (raw) => {
            if (!isRecord(raw)) return { lote_id: loteId, aprobada: false, aplicada: false }
            return {
                lote_id: String(raw.lote_id ?? loteId),
                aprobada: Boolean(raw.aprobada ?? false),
                aplicada: Boolean(raw.aplicada ?? false),
                decision_id: typeof raw.decision_id === "string" ? raw.decision_id : undefined,
                temp1_objetivo: typeof raw.temp1_objetivo === "number" ? raw.temp1_objetivo : undefined,
                vel_objetivo: typeof raw.vel_objetivo === "number" ? raw.vel_objetivo : undefined,
            }
        },
        allowEmptyData: true,
        invalidMessage: "La API devolvió una respuesta inválida al aprobar la consigna.",
        statusMessages: {
            404: "El lote no existe o no hay loop de control activo.",
            409: "No hay propuesta pendiente o el modo automático no requiere aprobación.",
        },
        revalidatePaths: ["/lotes", "/supervision"],
    });
}

/**
 * Cambia el modo operativo del control (MANUAL / SUPERVISION / AUTOMATICO).
 * PATCH /api/v1/lotes/{id}/modo con body `{ modo }`. Requiere Supervisor o
 * Administrador; el backend responde 403 cuando el rol no alcanza y 409 cuando
 * hay un loop de control corriendo que no se puede reanudar en el modo
 * solicitado. Tras `MANUAL` se cancela el loop automáticamente.
 */
export type ModoOperacion = NonNullable<LoteSector["modo"]>

export async function cambiarModo(
    loteId: string,
    modo: ModoOperacion,
): Promise<DeviceActionResult<{ lote_id: string; modo: ModoOperacion }>> {
    return deviceMutation<{ lote_id: string; modo: ModoOperacion }>({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/modo`,
        method: "PATCH",
        body: { modo },
        parse: (raw) => {
            // El parser corre SIEMPRE (sin `allowEmptyData`). Si el backend
            // responde con `data` ausente/null/record vacío, devolvemos un
            // fallback con el modo solicitado: el SSE `control.evento` será la
            // confirmación autoritativa.
            if (!isRecord(raw)) return { lote_id: loteId, modo }
            const next = raw.modo
            const parsedModo: ModoOperacion =
                next === "MANUAL" || next === "SUPERVISION" || next === "AUTOMATICO"
                    ? next
                    : modo
            return {
                lote_id: String(raw.lote_id ?? loteId),
                modo: parsedModo,
            }
        },
        invalidMessage: "La API devolvió una respuesta inválida al cambiar el modo.",
        statusMessages: {
            404: "El lote no existe.",
            409: "Conflicto al cambiar el modo: hay un loop activo o el lote no admite el modo solicitado.",
        },
        revalidatePaths: ["/lotes", `/lotes/${loteId}/control`],
    });
}

/** Body parcial para `PATCH /api/v1/lotes/{id}/control/parametros`. */
export type ControlParamsInput = Partial<Pick<ControlLimites, "tolerancia_temp_c">> & {
    umbral_aceptacion_crudo?: number
    umbral_aceptacion_quemado?: number
    /** `null` vuelve al valor definido por el producto. */
    delta_temp1_max_c?: number | null
    /** `null` vuelve al valor definido por el producto. */
    delta_vel_max?: number | null
}

/** Resultado de actualizar los parámetros de control de un lote. */
export type ControlParamsResult = { lote_id: string } & Partial<ControlLimites> & {
    umbral_aceptacion_crudo?: number
    umbral_aceptacion_quemado?: number
    delta_temp1_max_c?: number | null
    delta_vel_max?: number | null
}

/**
 * Ajusta los parámetros de control de un lote abierto (tolerancia, umbrales y
 * límites de variación por ciclo). Requiere rol Supervisor/Admin; el backend
 * aplica los cambios en el próximo tick del loop sin reiniciarlo.
 */
export async function updateControlParams(
    loteId: string,
    params: ControlParamsInput,
): Promise<DeviceActionResult<ControlParamsResult>> {
    return deviceMutation<ControlParamsResult>({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/control/parametros`,
        method: "PATCH",
        body: params,
        parse: (raw) => {
            if (!isRecord(raw)) return { lote_id: loteId }
            return {
                lote_id: String(raw.lote_id ?? loteId),
                tolerancia_temp_c: typeof raw.tolerancia_temp_c === "number" ? raw.tolerancia_temp_c : undefined,
                umbral_aceptacion_crudo: typeof raw.umbral_aceptacion_crudo === "number" ? raw.umbral_aceptacion_crudo : undefined,
                umbral_aceptacion_quemado: typeof raw.umbral_aceptacion_quemado === "number" ? raw.umbral_aceptacion_quemado : undefined,
                delta_temp1_max_c: typeof raw.delta_temp1_max_c === "number" ? raw.delta_temp1_max_c : undefined,
                delta_vel_max: typeof raw.delta_vel_max === "number" ? raw.delta_vel_max : undefined,
            }
        },
        invalidMessage: "La API devolvió una respuesta inválida al actualizar los parámetros.",
        statusMessages: {
            400: "Revisá los valores ingresados: están fuera de rango o faltan.",
            403: "Se requiere rol Supervisor o Administrador.",
            404: "El lote no existe.",
            409: "El lote no está abierto o no admite cambios de parámetros.",
        },
        revalidatePaths: ["/lotes", `/lotes/${loteId}/control`],
    });
}

/**
 * GET /api/v1/lotes/{id}/confianza-clases — confianza agregada del modelo de
 * visión por clase, sobre las últimas `limite` detecciones (default 200).
 * Devuelve un array vacío cuando el backend responde con `data` ausente o mal
 * formado, y cuando el lote no existe (404 → [] para que la UI degrade en
 * silencio a "sin muestras").
 */
export async function getConfianzaClases(
    loteId: string,
    limite = 200,
): Promise<ConfianzaClase[]> {
    const safeLimite = Math.min(2000, Math.max(1, Math.trunc(limite)))
    return withBackendFetch({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/confianza-clases?limite=${safeLimite}`,
        timeoutMessage: "El backend no respondió a tiempo. La confianza del modelo no está disponible.",
        handle: async (response) => {
            if (!response.ok) {
                if (response.status === 404) return []
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
            }
            const payload: unknown = await response.json().catch(() => null)
            const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
            const raw = Array.isArray(data?.clases) ? data.clases : []
            const parsed: ConfianzaClase[] = []
            for (const item of raw) {
                if (!isRecord(item)) continue
                const clase = typeof item.clase === "string" ? item.clase : ""
                const media = typeof item.confianza_media === "number" ? item.confianza_media : null
                const muestras = typeof item.muestras === "number" ? item.muestras : null
                if (!clase || media === null || muestras === null) continue
                const std = typeof item.confianza_stddev === "number" ? item.confianza_stddev : null
                parsed.push({ clase, confianza_media: media, confianza_stddev: std, muestras })
            }
            return parsed
        },
    }).catch(() => [])
}

/**
 * GET /api/v1/lotes/{id}/control/estado — estado runtime del loop.
 *
 * Devuelve si el loop del MPC está corriendo (`loop_activo`) y el modo
 * operativo actual. Es tolerante: si el lote no existe (404), el backend no
 * responde a tiempo o devuelve un shape inesperado, devuelve `null` (la UI
 * asume "loop no activo" para no mostrar CTAs sobre información incompleta).
 */
export async function getControlEstado(loteId: string): Promise<ControlEstado | null> {
    return withBackendFetch({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/control/estado`,
        timeoutMessage: "El backend no respondió a tiempo. El estado del control no está disponible.",
        handle: async (response) => {
            if (!response.ok) {
                if (response.status === 404) return null
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
            }
            const payload: unknown = await response.json().catch(() => null)
            const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
            if (!data) return null
            const modo = data.modo
            const modoParsed: ControlEstado["modo"] =
                modo === "MANUAL" || modo === "SUPERVISION" || modo === "AUTOMATICO"
                    ? modo
                    : "MANUAL"
            const started = data.started_at
            return {
                loop_activo: data.loop_activo === true,
                modo: modoParsed,
                started_at: typeof started === "string" ? started : null,
            }
        },
    }).catch(() => null)
}

/**
 * GET /api/v1/lotes/{id}/decisiones — audit del MPC.
 *
 * El backend tiene un límite interno (100); el caller puede acotar más con
 * `limite`. Si la fetch falla, propaga el error para que la UI pueda
 * distinguir "sin decisiones" de "falló la consulta" (antes se silenciaba
 * con `.catch(() => [])` y eso escondía problemas reales).
 */
export async function getDecisiones(
    loteId: string,
    limite = 50,
): Promise<DecisionControl[]> {
    const safeLimite = Math.min(100, Math.max(1, Math.trunc(limite)))
    return withBackendFetch({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/decisiones?limite=${safeLimite}`,
        timeoutMessage: "El backend no respondió a tiempo. Las decisiones no están disponibles.",
        handle: async (response) => {
            if (!response.ok) {
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
            }
            const payload: unknown = await response.json()
            if (!isRecord(payload) || payload.success !== true) {
                throw new Error("La API devolvió una respuesta inválida para las decisiones.")
            }
            const data = isRecord(payload.data) ? payload.data : null
            const items = Array.isArray(data?.decisiones) ? data.decisiones : []
            return items.filter(isRecord).map(parseDecisionControl)
        },
    })
}

/**
 * GET /api/v1/lotes/{id}/metricas-horno — últimas lecturas del horno.
 * El default es 1 (la más reciente) para el panel de estado actual.
 */
export async function getMetricasHorno(
    loteId: string,
    limite = 1,
): Promise<MetricaHorno[]> {
    const safeLimite = Math.min(200, Math.max(1, Math.trunc(limite)))
    return withBackendFetch({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/metricas-horno?limite=${safeLimite}`,
        timeoutMessage: "El backend no respondió a tiempo. La telemetría no está disponible.",
        handle: async (response) => {
            if (!response.ok) {
                if (response.status === 404) return []
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
            }
            const payload: unknown = await response.json()
            const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
            const items = Array.isArray(data?.metricas) ? data.metricas : []
            return items.filter(isRecord).map(parseMetricaHorno)
        },
    }).catch(() => [])
}

function parseMetricaHorno(raw: Record<string, unknown>): MetricaHorno {
    const num = (v: unknown) => (typeof v === "number" ? v : null)
    return {
        id: String(raw.id ?? ""),
        lote_id: String(raw.lote_id ?? ""),
        temp_horno_1: num(raw.temp_horno_1),
        temp_comb_1: num(raw.temp_comb_1),
        humedad_horno: num(raw.humedad_horno),
        temp_ambiente: num(raw.temp_ambiente),
        humedad_ambiente: num(raw.humedad_ambiente),
        velocidad_cinta: num(raw.velocidad_cinta),
        temp_objetivo: num(raw.temp_objetivo),
        vel_objetivo: num(raw.vel_objetivo),
        confianza_deteccion: num(raw.confianza_deteccion),
        received_at: String(raw.received_at ?? ""),
    }
}

function parseDecisionControl(raw: Record<string, unknown>): DecisionControl {
    const num = (v: unknown) => (typeof v === "number" ? v : null)
    return {
        id: String(raw.id ?? ""),
        lote_id: String(raw.lote_id ?? ""),
        ventana_inicio: String(raw.ventana_inicio ?? ""),
        ventana_fin: String(raw.ventana_fin ?? ""),
        muestras: typeof raw.muestras === "number" ? raw.muestras : 0,
        temp_actual: typeof raw.temp_actual === "number" ? raw.temp_actual : 0,
        vel_actual: num(raw.vel_actual),
        pct_crudos_obs: typeof raw.pct_crudos_obs === "number" ? raw.pct_crudos_obs : 0,
        pct_ok_obs: typeof raw.pct_ok_obs === "number" ? raw.pct_ok_obs : 0,
        pct_quemados_obs: typeof raw.pct_quemados_obs === "number" ? raw.pct_quemados_obs : 0,
        conf_promedio: typeof raw.conf_promedio === "number" ? raw.conf_promedio : 0,
        temp_propuesto: typeof raw.temp_propuesto === "number" ? raw.temp_propuesto : 0,
        vel_propuesto: typeof raw.vel_propuesto === "number" ? raw.vel_propuesto : 0,
        temp_aplicado: num(raw.temp_aplicado),
        vel_aplicado: num(raw.vel_aplicado),
        prediccion: parsePrediccion(raw.prediccion),
        z_observado: num(raw.z_observado),
        z_predicho: num(raw.z_predicho),
        razon_skipped: typeof raw.razon_skipped === "string" ? raw.razon_skipped : null,
        aplicado_por:
            raw.aplicado_por === "MPC" || raw.aplicado_por === "OPERARIO"
                ? raw.aplicado_por
                : "NADIE",
        aprobada_por: typeof raw.aprobada_por === "string" ? raw.aprobada_por : null,
        aprobada_at: typeof raw.aprobada_at === "string" ? raw.aprobada_at : null,
        created_at: String(raw.created_at ?? ""),
    }
}

function parsePrediccion(raw: unknown): PrediccionResumen | null {
    if (!isRecord(raw)) return null
    return {
        pctCrudos: typeof raw.pctCrudos === "number" ? raw.pctCrudos : 0,
        pctOk: typeof raw.pctOk === "number" ? raw.pctOk : 0,
        pctQuemados: typeof raw.pctQuemados === "number" ? raw.pctQuemados : 0,
        modelVersion: typeof raw.modelVersion === "string" ? raw.modelVersion : "",
        esPlaceholder: typeof raw.esPlaceholder === "boolean" ? raw.esPlaceholder : true,
        restriccionRelajada: typeof raw.restriccionRelajada === "boolean" ? raw.restriccionRelajada : undefined,
    }
}

/**
 * GET /api/v1/lotes/{id}/consigna-propuesta — devuelve la propuesta
 * pendiente en modo SUPERVISION, o `null` cuando el backend responde 204
 * (no hay propuesta pendiente) o la Pi ENTRADA todavía no la consumió.
 *
 * El Loop del MPC también emite la propuesta por SSE en `control.propuesta`,
 * pero este endpoint existe para sincronización pull-based (la UI pide el
 * snapshot al cargar y al reintentar después de un timeout).
 *
 * Soporta tanto la forma directa (`data` contiene la propuesta) como la
 * forma anidada legacy (`data.propuesta`).
 */
export async function getConsignaPropuesta(loteId: string): Promise<SetpointPropuesto | null> {
    return withBackendFetch({
        path: `/api/v1/lotes/${encodeURIComponent(loteId)}/consigna-propuesta`,
        timeoutMessage: "El backend no respondió a tiempo. La propuesta no está disponible.",
        handle: async (response) => {
            if (response.status === 204) return null
            if (!response.ok) {
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
            }
            let payload: unknown
            try {
                payload = await response.json()
            } catch {
                return null
            }
            if (!isRecord(payload) || payload.success !== true) return null
            const data = isRecord(payload.data) ? payload.data : null
            if (!data) return null
            // Forma directa (actual): la propuesta viene en `data`.
            const direct = typeof data.temp1_objetivo === "number" ? data : null
            // Forma anidada legacy: `data.propuesta`.
            const legacy = isRecord(data.propuesta) ? data.propuesta : null
            const raw = direct ?? legacy
            if (!isRecord(raw)) return null
            return parseSetpointPropuesto(raw)
        },
    }).catch(() => null)
}

function parseControlLimites(raw: unknown): ControlLimites | null {
    if (!isRecord(raw)) return null
    const temp_min = typeof raw.temp_min === "number" ? raw.temp_min : null
    const temp_max = typeof raw.temp_max === "number" ? raw.temp_max : null
    const vel_min = typeof raw.vel_min === "number" ? raw.vel_min : null
    const vel_max = typeof raw.vel_max === "number" ? raw.vel_max : null
    const delta_temp1_max_c = typeof raw.delta_temp1_max_c === "number" ? raw.delta_temp1_max_c : null
    const delta_vel_max = typeof raw.delta_vel_max === "number" ? raw.delta_vel_max : null
    const tolerancia_temp_c = typeof raw.tolerancia_temp_c === "number" ? raw.tolerancia_temp_c : null
    if (
        temp_min === null ||
        temp_max === null ||
        vel_min === null ||
        vel_max === null ||
        delta_temp1_max_c === null ||
        delta_vel_max === null ||
        tolerancia_temp_c === null
    ) {
        return null
    }
    return { temp_min, temp_max, vel_min, vel_max, delta_temp1_max_c, delta_vel_max, tolerancia_temp_c }
}

function parseSetpointPropuesto(raw: Record<string, unknown>): SetpointPropuesto | null {
    const temp1 =
        typeof raw.temp1_objetivo === "number"
            ? raw.temp1_objetivo
            : typeof raw.temp1 === "number"
              ? raw.temp1
              : null
    const velocidad =
        typeof raw.vel_objetivo === "number"
            ? raw.vel_objetivo
            : typeof raw.velocidad === "number"
              ? raw.velocidad
              : null
    if (temp1 === null || velocidad === null) return null
    const z = typeof raw.z === "number" ? raw.z : 0
    const pred = isRecord(raw.prediccion) ? raw.prediccion : null
    const limites = parseControlLimites(raw.limites)
    return {
        temp1,
        velocidad,
        z,
        prediccion: pred
            ? {
                pctCrudos: typeof pred.pctCrudos === "number" ? pred.pctCrudos : undefined,
                pctOk: typeof pred.pctOk === "number" ? pred.pctOk : undefined,
                pctQuemados: typeof pred.pctQuemados === "number" ? pred.pctQuemados : undefined,
                modelVersion: typeof pred.modelVersion === "string" ? pred.modelVersion : undefined,
                esPlaceholder: typeof pred.esPlaceholder === "boolean" ? pred.esPlaceholder : undefined,
                restriccionRelajada: typeof pred.restriccionRelajada === "boolean" ? pred.restriccionRelajada : undefined,
            }
            : null,
        ventana_inicio: typeof raw.ventana_inicio === "string" ? raw.ventana_inicio : undefined,
        ventana_fin: typeof raw.ventana_fin === "string" ? raw.ventana_fin : undefined,
        autorizada: raw.autorizada === true,
        fase: typeof raw.fase === "string" ? raw.fase : null,
        decision_id: typeof raw.decision_id === "string" ? raw.decision_id : null,
        limites,
    }
}

// ─── Alertas operativas ─────────────────────────────────────────────────────

const ALERTA_ESTADOS = ["ACTIVA", "ACK", "RESUELTA"] as const
const ALERTA_SEVERIDADES = ["INFO", "WARNING", "CRITICAL"] as const

function parseAlertaEstado(value: unknown): Alerta["estado"] {
    return typeof value === "string" && (ALERTA_ESTADOS as readonly string[]).includes(value)
        ? (value as Alerta["estado"])
        : "ACTIVA"
}

function parseAlertaSeveridad(value: unknown): Alerta["severidad"] {
    return typeof value === "string" && (ALERTA_SEVERIDADES as readonly string[]).includes(value)
        ? (value as Alerta["severidad"])
        : "INFO"
}

function parseAlerta(raw: unknown): Alerta | null {
    if (!isRecord(raw)) return null
    const id = typeof raw.id === "string" ? raw.id : ""
    const tipo = typeof raw.tipo === "string" ? raw.tipo : ""
    const mensaje = typeof raw.mensaje === "string" ? raw.mensaje : ""
    const createdAt = typeof raw.created_at === "string" ? raw.created_at : ""
    if (!id || !tipo || !mensaje || !Number.isFinite(Date.parse(createdAt))) return null
    return {
        id,
        sector_id: typeof raw.sector_id === "string" ? raw.sector_id : null,
        lote_id: typeof raw.lote_id === "string" ? raw.lote_id : null,
        tipo,
        severidad: parseAlertaSeveridad(raw.severidad),
        estado: parseAlertaEstado(raw.estado),
        mensaje,
        created_at: createdAt,
        acked_por: isRecord(raw.acked_por)
            ? {
                  email: typeof raw.acked_por.email === "string" ? raw.acked_por.email : "",
                  nombre: typeof raw.acked_por.nombre === "string" ? raw.acked_por.nombre : "",
              }
            : null,
        acked_at: typeof raw.acked_at === "string" ? raw.acked_at : null,
    }
}

/**
 * GET /api/v1/alertas?estado=ACTIVA|ACK|RESUELTA — lista las alertas
 * operativas. La query `estado` es opcional; cuando se omite, el backend
 * devuelve el conjunto activo (depende del backend). Tolerante: si el endpoint
 * no existe todavía (404) o devuelve forma inválida, expone `[]` para que la
 * UI degrade como "sin alertas".
 */
export async function getAlertas(opts?: {
    estado?: Alerta["estado"]
}): Promise<Alerta[]> {
    const params = new URLSearchParams()
    if (opts?.estado) params.set("estado", opts.estado)
    const query = params.toString()
    const path = `/api/v1/alertas${query ? `?${query}` : ""}`
    return withBackendFetch({
        path,
        timeoutMessage: "El backend no respondió a tiempo. Las alertas no están disponibles.",
        handle: async (response) => {
            if (!response.ok) {
                if (response.status === 404) return []
                throw new Error(`La API respondió con ${response.status}: ${response.statusText}`)
            }
            const payload: unknown = await response.json().catch(() => null)
            const raw = isRecord(payload) && Array.isArray(payload.data)
                ? payload.data
                : []
            const out: Alerta[] = []
            for (const item of raw) {
                const parsed = parseAlerta(item)
                if (parsed) out.push(parsed)
            }
            return out
        },
    }).catch(() => [])
}

/**
 * POST /api/v1/alertas/{id}/ack — reconoce una alerta. Devuelve la versión
 * actualizada con `estado: "ACK"` y `acked_por`/`acked_at` populados.
 */
export async function ackAlerta(id: string): Promise<DeviceActionResult<Alerta>> {
    return deviceMutation<Alerta>({
        path: `/api/v1/alertas/${encodeURIComponent(id)}/ack`,
        method: "POST",
        parse: (raw) => parseAlerta(raw),
        invalidMessage: "La API devolvió una alerta inválida al acuse de recibo.",
        statusMessages: {
            404: "La alerta no existe.",
            409: "La alerta ya fue reconocida o resuelta.",
        },
        revalidatePaths: ["/alertas"],
    });
}
