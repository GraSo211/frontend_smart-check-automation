import { describe, expect, it } from "vitest"
import { getReconnectDelay } from "@/components/supervision/live-camera"

describe("reconexión de cámara", () => {
  it("usa backoff progresivo y mantiene el máximo en 10 segundos", () => {
    expect([0, 1, 2, 3, 4].map(getReconnectDelay)).toEqual([1000, 2000, 5000, 10000, 10000])
  })
})
