export type DeviceResponse = {
    success: boolean;
    message: string;
    data: Device[];
};

export type CreateDispositivoRequest = {
    nombre: string;
    ubicacion: string;
};

export type UpdateDispositivoRequest = {
    dispositivoId: string;
    nombre: string;
    ubicacion: string;
};

export type Device = {
    dispositivoId: string;
    nombre: string;
    ubicacion: string;
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
