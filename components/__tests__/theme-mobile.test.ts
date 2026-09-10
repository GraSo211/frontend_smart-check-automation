import { describe, expect, it, vi } from "vitest"
import { getMountedServerSnapshot, getMountedSnapshot, subscribeMounted } from "@/components/mode-toggle"
import {
  getMobileServerSnapshot,
  getMobileSnapshot,
  subscribeToMobileMedia,
} from "@/hooks/use-mobile"

describe("suscripciones theme/mobile", () => {
  it("usa snapshot server estable y mounted cliente sin effect de estado", () => {
    expect(getMountedServerSnapshot()).toBe(false)
    expect(getMountedSnapshot()).toBe(true)
    expect(subscribeMounted()).toBeTypeOf("function")
  })

  it("mantiene snapshot SSR mobile en false y suscribe/desuscribe el media query", () => {
    expect(getMobileServerSnapshot()).toBe(false)
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const matchMedia = vi.fn((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    }))
    vi.stubGlobal("window", { matchMedia })

    expect(getMobileSnapshot()).toBe(true)
    matchMedia.mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)" && false,
      media: query,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    }))
    expect(getMobileSnapshot()).toBe(false)
    matchMedia.mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    }))
    const listener = vi.fn()
    const cleanup = subscribeToMobileMedia(listener)
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)")
    expect(listeners.size).toBe(1)
    listeners.forEach((callback) => callback({} as MediaQueryListEvent))
    expect(listener).toHaveBeenCalledOnce()
    cleanup()
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })
})
