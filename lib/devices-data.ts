export type DeviceResponse = {
    success: boolean;
    message: string;
    data: Device[];
};

/**
 * Estado de la credencial del nodo. Es independiente de la conectividad
 * (`estado`): un nodo deshabilitado puede tener un heartbeat reciente pero no
 * puede autenticarse para reportar.
 */
export type AuthStatus = "unenrolled" | "active" | "disabled" | "revoked";

export const AUTH_STATUS_LABELS: Record<AuthStatus, string> = {
    unenrolled: "Sin enrolar",
    active: "Activo",
    disabled: "Deshabilitado",
    revoked: "Revocado",
};

/** Resuelve el estado de credencial de un nodo, con "unenrolled" como heredado. */
export function deviceAuthStatus(device: Pick<Device, "authStatus">): AuthStatus {
    return device.authStatus ?? "unenrolled";
}

/** Estado de una solicitud de registro de dispositivo enviada por un nodo. */
export type RegistrationRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

/** Solicitud de registro pendiente de aprobación/rechazo (panel). */
export type RegistrationRequest = {
    requestId: string;
    hostname: string;
    status: RegistrationRequestStatus;
    deviceId?: string;
    createdAt: string;
    expiresAt: string;
};

/** Resultado normalizado de aprobar una solicitud (el backend lo envía en snake_case). */
export type RegistrationApproval = {
    requestId: string;
    status: "APPROVED";
    deviceId: string;
};

/** Resultado normalizado de rechazar una solicitud. */
export type RegistrationRejection = {
    requestId: string;
    status: "REJECTED";
};

export type Device = {
    dispositivoId: string;
    nombre: string;
    ubicacion: string;
    /** URL WHEP de la cámara publicada por este nodo. Opcional. */
    whepUrl?: string;
    estado: "online" | "offline";
    ultimaMetrica?: {
        id: string;
        dispositivoId: string;
        cpuPct: number;
        memRamDisponibleMb: number;
        memRamTotalMb?: number;
        almacenamientoDisponibleMb?: number;
        almacenamientoTotalMb?: number;
        tempChip: number;
        aiProcessorPct: number;
        receivedAt: string;
    };
    lastSeen: string;
    /**
     * Campos de seguridad del catálogo. Opcionales porque los eventos SSE de
     * telemetría no los incluyen; el backend los devuelve siempre en GET.
     */
    authStatus?: AuthStatus;
    /** Indica si el nodo ya posee un secreto de autenticación provisionado. */
    hasSecret?: boolean;
    authUpdatedAt?: string | null;
};

export type UpdateDispositivoRequest = {
    dispositivoId: string;
    nombre: string;
    ubicacion: string;
    whepUrl?: string;
};

export type DeviceHistoryResponse = {
    success: boolean;
    message: string;
    data: SpecificDevice[];
    total: number;
    page: number;
    pageSize: number;
};

export type SpecificDevice = {
    id: string;
    dispositivoId: string;
    nombre: string;
    cpuPct: number;
    memRamDisponibleMb: number;
    memRamTotalMb?: number;
    almacenamientoDisponibleMb?: number;
    almacenamientoTotalMb?: number;
    tempChip: number;
    aiProcessorPct: number;
    receivedAt: string;
};
