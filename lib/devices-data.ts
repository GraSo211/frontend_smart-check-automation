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

/** Invitación de aprovisionamiento pendiente (reprovisión de un nodo existente). */
export type PendingEnrollment = {
    enrollmentId: string;
    expiresAt: string;
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
    /** Huella de la credencial vigente (sólo active/disabled). */
    keyFingerprint?: string | null;
    enrolledAt?: string | null;
    authUpdatedAt?: string | null;
    /** `null` = sin invitación pendiente; ausente = payload sin el campo. */
    pendingEnrollment?: PendingEnrollment | null;
};

/** Datos del formulario para emitir una invitación de enrolamiento. */
export type EnrollmentCreateRequest = {
    nombre: string;
    ubicacion?: string;
    whepUrl?: string;
};

export type UpdateDispositivoRequest = {
    dispositivoId: string;
    nombre: string;
    ubicacion: string;
    whepUrl?: string;
};

/**
 * Invitación de aprovisionamiento. `code` se incluye SÓLO en la respuesta de
 * emisión (creación o reprovisión); los listados nunca lo exponen.
 */
export type EnrollmentInvitation = {
    enrollmentId: string;
    dispositivoId: string | null;
    nombre: string;
    ubicacion?: string;
    whepUrl?: string;
    status: "pending";
    code?: string;
    createdAt: string;
    expiresAt: string;
};

/** Respuesta del endpoint de cancelación. */
export type EnrollmentCancelResult = {
    enrollmentId: string;
    status: "cancelled";
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
