import { describe, expect, it } from "vitest"
import { clampPage, pageCount, reconcilePage } from "@/components/shared/pagination-state"

describe("pagination state", () => {
  it("keeps empty datasets on a valid single page", () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(clampPage(4, pageCount(0, 10))).toBe(1)
  })

  it("clamps a page when a dataset shrinks", () => {
    const pageAfterShrink = clampPage(4, pageCount(11, 10))

    expect(pageAfterShrink).toBe(2)
  })

  it("does not restore a stale page when the dataset grows again", () => {
    const pageAfterShrink = clampPage(4, pageCount(0, 10))

    expect(clampPage(pageAfterShrink, pageCount(50, 10))).toBe(1)
  })

  it("prioritizes an identity reset over a simultaneous count clamp", () => {
    expect(reconcilePage(5, true, true, 3)).toBe(1)
  })

  it("clamps the same device and keeps page one after empty data grows", () => {
    expect(reconcilePage(5, false, true, 3)).toBe(3)
    expect(reconcilePage(1, false, true, 5)).toBe(1)
  })
})
