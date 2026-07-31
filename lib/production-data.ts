// Type definition mirroring the API response shape for a production run record.
export interface ProductionRun {
  id: string
  productoId: string
  productoNombre: string
  turno: "mañana" | "tarde" | "noche"
  inicioAt: string
  finAt: string
  totalUnidades: number
  correctos: number
  quemados: number
  crudas: number | null
  correctosKg: number
  quemadosKg: number
  crudosKg: number | null
  tempHorno1: number
  tempCombHorno1: number
  tempHorno2: number
  tempCombHorno2: number
  velocidadHorno: number
  createdAt: string
  updatedAt: string
}

export interface ProductionResponse {
  success: boolean
  message: string
  data: {items: ProductionRun[]}
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PRODUCTS = [
  "Tostada Integral",
  "Pan Francés",
  "Pan de Molde",
  "Galleta de Avena",
  "Pan Ciabatta",
  "Bizcocho de Vainilla",
  "Pan Centeno",
  "Croissant Mantequilla",
]

const SHIFTS: ProductionRun["turno"][] = ["mañana", "tarde", "noche"]

// Deterministic pseudo-random generator so the dataset is stable across renders.
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// Builds a realistic, stable dataset of production runs for the bakery line.
function buildRuns(count: number): ProductionRun[] {
  const rand = seeded(42)
  const runs: ProductionRun[] = []

  for (let i = 0; i < count; i++) {
    const turno = SHIFTS[i % SHIFTS.length]
    const total = 800 + Math.floor(rand() * 1600)
    // Occasionally simulate a line failure with elevated burnt units.
    const failure = rand() > 0.78
    const quemados = failure
      ? Math.floor(total * (0.06 + rand() * 0.05))
      : Math.floor(total * (0.005 + rand() * 0.02))
    const crudas = failure
      ? Math.floor(total * (0.02 + rand() * 0.03))
      : 0
    const correctos = total - quemados - crudas

    const baseHour = turno === "mañana" ? 6 : turno === "tarde" ? 14 : 22
    const day = 2 + (i % 12)
    const inicio = new Date(Date.UTC(2026, 5, day, baseHour, 0, 0))
    const fin = new Date(inicio.getTime() + (2 * 60 + Math.floor(rand() * 60)) * 60000)

    const tempH1 = 200 + Math.floor(rand() * 30)
    const tempH2 = 205 + Math.floor(rand() * 30)

    runs.push({
      id: `550e8400-e29b-41d4-a716-${(446655440000 + i).toString().padStart(12, "0")}`,
      productoId: `a1b2c3d4-${i.toString().padStart(4, "0")}`,
      productoNombre: PRODUCTS[i % PRODUCTS.length],
      turno,
      inicioAt: inicio.toISOString(),
      finAt: fin.toISOString(),
      totalUnidades: total,
      correctos,
      quemados,
      crudas,
      correctosKg: Math.round(correctos * 0.18 * 10) / 10,
      quemadosKg: Math.round(quemados * 0.19 * 10) / 10,
      crudosKg: crudas > 0 ? Math.round(crudas * 0.17 * 10) / 10 : null,
      tempHorno1: tempH1,
      tempCombHorno1: tempH1 - 12 - Math.floor(rand() * 8),
      tempHorno2: tempH2,
      tempCombHorno2: tempH2 - 12 - Math.floor(rand() * 8),
      velocidadHorno: 2 + Math.floor(rand() * 20) / 10,
      createdAt: inicio.toISOString(),
      updatedAt: fin.toISOString(),
    })
  }

  return runs
}

export const PRODUCTION_RUNS = buildRuns(50);

// Simulates a paginated API response from the in-memory dataset.
export function getProductionPage(page: number, pageSize: number): ProductionResponse {
  const start = (page - 1) * pageSize
  return {
    success: true,
    message: "Datos de producción simulados",
    data: { items: PRODUCTION_RUNS.slice(start, start + pageSize) },
    total: PRODUCTION_RUNS.length,
    page,
    pageSize,
    totalPages: Math.ceil(PRODUCTION_RUNS.length / pageSize),
  }
}
