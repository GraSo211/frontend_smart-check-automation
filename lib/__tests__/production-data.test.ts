import { describe, it, expect } from "vitest"
import { PRODUCTION_RUNS, getProductionPage } from "@/lib/production-data"

describe("PRODUCTION_RUNS", () => {
  it("has exactly 50 entries", () => {
    expect(PRODUCTION_RUNS).toHaveLength(50)
  })

  it("every run has required fields", () => {
    for (const run of PRODUCTION_RUNS) {
      expect(run.id).toBeTruthy()
      expect(run.productoNombre).toBeTruthy()
      expect(["mañana", "tarde", "noche"]).toContain(run.turno)
      expect(run.totalUnidades).toBeGreaterThan(0)
      expect(run.correctos).toBeGreaterThan(0)
      expect(run.inicioAt).toBeTruthy()
      expect(run.finAt).toBeTruthy()
    }
  })

  it("products in deterministic order", () => {
    expect(PRODUCTION_RUNS[0].productoNombre).toBe("Tostada Integral")
    expect(PRODUCTION_RUNS[1].productoNombre).toBe("Pan Francés")
  })
})

describe("getProductionPage", () => {
  it("returns first page of 10 items", () => {
    const page = getProductionPage(1, 10)
    expect(page.data).toHaveLength(10)
    expect(page.total).toBe(50)
    expect(page.page).toBe(1)
    expect(page.pageSize).toBe(10)
  })

  it("returns last page with remaining items", () => {
    const page = getProductionPage(5, 10)
    expect(page.data).toHaveLength(10)
  })

  it("returns page beyond total as empty", () => {
    const page = getProductionPage(10, 10)
    expect(page.data).toHaveLength(0)
  })
})
