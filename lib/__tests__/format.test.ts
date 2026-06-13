import { describe, it, expect } from "vitest"
import {
  formatNumber,
  formatKg,
  formatDate,
  formatTime,
  formatWindow,
  qualityRate,
} from "@/lib/format"

describe("formatNumber", () => {
  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0")
  })

  it("formats a small number", () => {
    expect(formatNumber(42)).toBe("42")
  })

  it("formats a number with thousands separator", () => {
    expect(formatNumber(1200)).toBe("1.200")
  })

  it("formats a large number", () => {
    expect(formatNumber(1_500_000)).toBe("1.500.000")
  })
})

describe("formatKg", () => {
  it("formats kilograms with one decimal", () => {
    expect(formatKg(220.5)).toBe("220,5 kg")
  })

  it("formats whole number kilograms", () => {
    expect(formatKg(100)).toBe("100,0 kg")
  })

  it("formats zero kilograms", () => {
    expect(formatKg(0)).toBe("0,0 kg")
  })
})

describe("formatDate", () => {
  it("formats an ISO date string to es-AR short format", () => {
    const result = formatDate("2026-06-02T06:00:00.000Z")
    expect(result).toContain("jun")
    expect(result).toContain("02")
  })
})

describe("formatTime", () => {
  it("formats an ISO time string to HH:mm", () => {
    expect(formatTime("2026-06-02T06:00:00.000Z")).toBe("06:00")
  })

  it("pads single-digit hours", () => {
    expect(formatTime("2026-06-02T08:30:00.000Z")).toBe("08:30")
  })
})

describe("formatWindow", () => {
  it("builds a compact date · time–time string", () => {
    const result = formatWindow("2026-06-02T06:00:00.000Z", "2026-06-02T08:30:00.000Z")
    expect(result).toContain("·")
    expect(result).toContain("06:00")
    expect(result).toContain("08:30")
  })
})

describe("qualityRate", () => {
  it("returns 100% when all units are correct", () => {
    expect(qualityRate(1000, 1000)).toBe(100)
  })

  it("returns 0% when no units are correct", () => {
    expect(qualityRate(0, 1000)).toBe(0)
  })

  it("returns 50% for half correct", () => {
    expect(qualityRate(500, 1000)).toBe(50)
  })

  it("returns 0 when total is 0 (no division by zero)", () => {
    expect(qualityRate(0, 0)).toBe(0)
  })
})
