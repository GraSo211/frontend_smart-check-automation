"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import type {
    Device,
    EnrollmentCancelResult,
    EnrollmentCreateRequest,
    EnrollmentInvitation,
    SpecificDevice,
    UpdateDispositivoRequest,
} from "@/lib/devices-data";
import type { ProductionRun } from "@/lib/production-data";
import { parseDevice, parseDevicesPayload, parseProductionPayload } from "@/lib/monitoring-runtime";
import {
    parseEnrollmentCancel,
    parseEnrollmentInvitation,
    parseEnrollmentInvitations,
} from "@/lib/enrollment";
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

// ─── Catálogo de nodos: metadatos y ciclo de vida de credenciales ────────────
//
// La creación directa de dispositivos ya no existe (POST/DELETE
// /api/v1/dispositivos responden 405). El alta pasa por una invitación de
// aprovisionamiento de uso único que la Raspberry consume. Estas acciones
// mantienen al backend como autoridad: sólo traducen el envelope de error y
// revalidan la ruta /nodos.

export type DeviceActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; errors: string[]; code?: string };

// Códigos de error del backend traducidos a mensajes es-AR claros.
const ENROLLMENT_ERROR_MESSAGES: Record<string, string> = {
    validation_error: "Revisá los datos ingresados.",
    enrollment_consumed: "La invitación ya fue consumida por un dispositivo.",
    enrollment_unavailable: "La invitación ya no está disponible (venció o fue cancelada).",
    invalid_transition: "La operación no es válida para el estado actual del nodo.",
    invalid_lifecycle_transition: "La operación no es válida para el estado actual del nodo.",
    device_not_found: "El dispositivo no existe.",
    credential_revoked: "La credencial fue revocada.",
    credential_used: "La credencial ya fue utilizada.",
    human_auth_required: "Se requiere una sesión con rol Supervisor o Administrador.",
    unauthorized: "Sesión expirada o permisos insuficientes.",
    rate_limited: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.",
    internal_error: "Ocurrió un error interno en el servidor.",
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
): { errors: string[]; code?: string } {
    const code = errorCodeOf(result)
    if (code && ENROLLMENT_ERROR_MESSAGES[code]) {
        return { errors: [ENROLLMENT_ERROR_MESSAGES[code]], code }
    }
    if (isRecord(result) && Array.isArray(result.errors)) {
        const list = result.errors.map(String).filter(Boolean)
        if (list.length > 0) return { errors: list, ...(code ? { code } : {}) }
    }
    if (isRecord(result) && typeof result.message === "string" && result.message) {
        return { errors: [result.message], ...(code ? { code } : {}) }
    }
    if (response.status === 401 || response.status === 403) {
        return { errors: [ENROLLMENT_ERROR_MESSAGES.unauthorized], code: "unauthorized" }
    }
    if (response.status === 429) {
        return { errors: [ENROLLMENT_ERROR_MESSAGES.rate_limited], code: "rate_limited" }
    }
    return {
        errors: [`La API respondió con ${response.status}: ${response.statusText}`],
        ...(code ? { code } : {}),
    }
}

interface DeviceMutationOptions<T> {
    path: string
    method: "POST" | "PUT"
    body?: unknown
    parse: (data: unknown) => T | null
    invalidMessage: string
}

// Shared POST/PUT helper: cookie-forwarded, no-store, 8s timeout, revalidates
// the /nodos route on success and translates the error envelope.
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
            body: JSON.stringify(options.body ?? {}),
            cache: "no-store",
            signal: controller.signal,
        });

        const result: unknown = await response.json().catch(() => null);

        if (response.ok && isRecord(result) && result.success === true) {
            const data = options.parse(result.data);
            if (data === null) return { ok: false, errors: [options.invalidMessage] };
            revalidatePath("/nodos");
            return { ok: true, data };
        }

        return { ok: false, ...errorsFromResponse(result, response) };
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            return { ok: false, errors: ["El backend no respondió a tiempo (¿Render en cold-start?)."] };
        }
        return { ok: false, errors: [e instanceof Error ? e.message : "Error desconocido"] };
    } finally {
        clearTimeout(timeout);
    }
}

// Invitaciones pendientes de aprovisionamiento (lectura: cualquier rol).
export async function getEnrollmentInvitations(): Promise<EnrollmentInvitation[]> {
    const apiUrl = getApiUrl();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${apiUrl}/api/v1/dispositivos/enrollments`, {
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
        const data = parseEnrollmentInvitations(result);
        if (data === null) {
            if (isRecord(result) && result.success === false) {
                throw new Error(getResponseMessage(result));
            }
            throw new Error("La API devolvió una respuesta inválida para las invitaciones pendientes.");
        }
        return data;
    } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error("El backend no respondió a tiempo (¿Render en cold-start?). Las invitaciones no están disponibles.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

// Emite una invitación temporal de uso único. El `code` viene SÓLO en esta
// respuesta; nunca se lista ni se vuelve a mostrar.
export async function createEnrollmentInvitation(
    payload: EnrollmentCreateRequest,
): Promise<DeviceActionResult<EnrollmentInvitation>> {
    const nombre = payload.nombre.trim();
    const ubicacion = payload.ubicacion?.trim() ?? "";
    const whepUrl = normalizeWhepUrl(payload.whepUrl);
    return deviceMutation<EnrollmentInvitation>({
        path: "/api/v1/dispositivos/enrollments",
        method: "POST",
        body: {
            nombre,
            ...(ubicacion ? { ubicacion } : {}),
            ...(whepUrl ? { whepUrl } : {}),
        },
        parse: parseEnrollmentInvitation,
        invalidMessage: "La API devolvió una invitación inválida.",
    });
}

// Cancela una invitación pendiente. Consumida => 409 enrollment_consumed.
export async function cancelEnrollment(
    enrollmentId: string,
): Promise<DeviceActionResult<EnrollmentCancelResult>> {
    return deviceMutation<EnrollmentCancelResult>({
        path: `/api/v1/dispositivos/enrollments/${encodeURIComponent(enrollmentId)}/cancel`,
        method: "POST",
        parse: parseEnrollmentCancel,
        invalidMessage: "La API devolvió una respuesta inválida al cancelar la invitación.",
    });
}

function lifecycleAction(
    dispositivoId: string,
    action: "disable" | "enable" | "revoke",
): Promise<DeviceActionResult<Device>> {
    return deviceMutation<Device>({
        path: `/api/v1/dispositivos/${encodeURIComponent(dispositivoId)}/${action}`,
        method: "POST",
        parse: parseDevice,
        invalidMessage: "La API devolvió un dispositivo inválido.",
    });
}

export async function disableDispositivo(dispositivoId: string): Promise<DeviceActionResult<Device>> {
    return lifecycleAction(dispositivoId, "disable");
}

export async function enableDispositivo(dispositivoId: string): Promise<DeviceActionResult<Device>> {
    return lifecycleAction(dispositivoId, "enable");
}

export async function revokeDispositivo(dispositivoId: string): Promise<DeviceActionResult<Device>> {
    return lifecycleAction(dispositivoId, "revoke");
}

// Reprovisión: revoca la credencial anterior e invalida invitaciones previas;
// devuelve una invitación nueva (201) con `code` de uso único.
export async function reprovisionDispositivo(
    dispositivoId: string,
): Promise<DeviceActionResult<EnrollmentInvitation>> {
    return deviceMutation<EnrollmentInvitation>({
        path: `/api/v1/dispositivos/${encodeURIComponent(dispositivoId)}/reprovision`,
        method: "POST",
        parse: parseEnrollmentInvitation,
        invalidMessage: "La API devolvió una invitación de reprovisión inválida.",
    });
}

// Updates the name and location of an existing node (PUT /api/v1/dispositivos).
export async function updateDispositivo(
    payload: UpdateDispositivoRequest,
): Promise<DeviceActionResult<Device>> {
    return deviceMutation<Device>({
        path: "/api/v1/dispositivos",
        method: "PUT",
        body: { ...payload, whepUrl: normalizeWhepUrl(payload.whepUrl) },
        parse: parseDevice,
        invalidMessage: "La API devolvió un dispositivo inválido.",
    });
}
