export type DeviceResponse = {
    success: boolean;
    message: string;
    data: Device[];
};

export type Device = {
    dispositivoId: string;
    nombre: string;
    ubicacion: string;
    estado: "online" | "offline";
    ultimaMetrica: {
        id: string;
        dispositivoId: string;
        cpuPct: number;
        memRamDisponibleMb: number;
        tempChip: number;
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
    tempChip: number;
    receivedAt: string;
};

// Device fleet metadata. Ids are short, readable and stable so the truncated
// id shown on each card stays meaningful.
const NODES: Array<Pick<Device, "dispositivoId" | "nombre" | "ubicacion">> = [
    { dispositivoId: "raspi-horno-01", nombre: "Nodo Horno 1", ubicacion: "Línea A — Sector Horneado" },
    { dispositivoId: "raspi-horno-02", nombre: "Nodo Horno 2", ubicacion: "Línea B — Sector Horneado" },
    { dispositivoId: "raspi-amasa-01", nombre: "Nodo Amasadora", ubicacion: "Línea A — Sector Amasado" },
    { dispositivoId: "raspi-camara-01", nombre: "Nodo Cámara Fría", ubicacion: "Planta — Cámara de frío" },
    { dispositivoId: "raspi-empaq-01", nombre: "Nodo Empaque", ubicacion: "Planta — Línea de empaque" },
    { dispositivoId: "raspi-centro-01", nombre: "Nodo Distribución", ubicacion: "Depósito Central" },
];

// Deterministic pseudo-random generator so the dataset is stable across renders.
function seeded(seed: number) {
    let value = seed
    return () => {
        value = (value * 9301 + 49297) % 233280
        return value / 233280
    }
}

function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % 233280
    }
    return hash || 1
}

function round1(n: number): number {
    return Math.round(n * 10) / 10
}

// Builds a realistic, stable snapshot of the device fleet. Two nodes are
// offline so the state-dependent icons can be exercised.
function buildDevices(): Device[] {
    const now = Date.now()
    return NODES.map((node, i) => {
        const rand = seeded(100 + i)
        const offline = i === 4 || i === 5
        const cpuPct = round1(10 + rand() * 75)
        const memRamDisponibleMb = Math.round(900 + rand() * 2900)
        const tempChip = round1(38 + rand() * 22)
        const receivedAt = new Date(
            now - (offline ? 45 + Math.floor(rand() * 300) : Math.floor(rand() * 50)) * 60000,
        ).toISOString()

        return {
            dispositivoId: node.dispositivoId,
            nombre: node.nombre,
            ubicacion: node.ubicacion,
            estado: offline ? "offline" : "online",
            ultimaMetrica: {
                id: `metric-${node.dispositivoId}`,
                dispositivoId: node.dispositivoId,
                cpuPct,
                memRamDisponibleMb,
                tempChip,
                receivedAt,
            },
            lastSeen: receivedAt,
        }
    })
}

export const DEVICES: Device[] = buildDevices();

// Builds historical telemetry rows for a device, most recent first, at
// five-minute intervals over the last `count` measurements.
function buildDeviceHistory(dispositivoId: string, nombre: string, count: number): SpecificDevice[] {
    const rand = seeded(hashString(dispositivoId))
    const now = Date.now()
    const rows: SpecificDevice[] = []

    for (let i = 0; i < count; i++) {
        rows.push({
            id: `hist-${dispositivoId}-${i}`,
            dispositivoId,
            nombre,
            cpuPct: round1(10 + rand() * 75),
            memRamDisponibleMb: Math.round(900 + rand() * 2900),
            tempChip: round1(38 + rand() * 22),
            receivedAt: new Date(now - i * 5 * 60000).toISOString(),
        })
    }

    return rows
}

// Simulates a paginated API response from the in-memory history dataset.
export function getDeviceHistoryPage(
    dispositivoId: string,
    page: number,
    pageSize: number,
): DeviceHistoryResponse {
    const device = DEVICES.find((d) => d.dispositivoId === dispositivoId)
    const rows = buildDeviceHistory(dispositivoId, device?.nombre ?? "Nodo", 60)
    const start = (page - 1) * pageSize

    return {
        success: true,
        message: "Historial de telemetría simulado",
        data: rows.slice(start, start + pageSize),
        total: rows.length,
        page,
        pageSize,
    }
}
