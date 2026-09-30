import { describe, test, expect } from "vitest"
import { normaliseSan, looksLikeSan } from "./SanNormalizer"

describe("SanNormalizer service", () => {
  test("normaliseSan strips annotations, move numbers, NAG codes", () => {
    expect(normaliseSan("12. e4!?")).toBe("e4")
    expect(normaliseSan("1... Nf6+")).toBe("Nf6+")
    expect(normaliseSan("O-O-O#")).toBe("O-O-O#")
    expect(normaliseSan("e8=Q $1")).toBe("e8=Q")
    expect(normaliseSan("1-0")).toBe("")
    expect(normaliseSan("1/2-1/2")).toBe("")
  })

  test("looksLikeSan rejects pure numbers and move numbers with dots", () => {
    expect(looksLikeSan("1.")).toBe(false)
    expect(looksLikeSan("12.")).toBe(false)
    expect(looksLikeSan("1...")).toBe(false)
    expect(looksLikeSan("123")).toBe(false)
    expect(looksLikeSan("a")).toBe(false) // too short (<2)
    expect(looksLikeSan("toolongmovename")).toBe(false) // too long (>7)
    expect(looksLikeSan("e4")).toBe(true)
    expect(looksLikeSan("Nf3")).toBe(true)
    expect(looksLikeSan("O-O")).toBe(true)
    expect(looksLikeSan("exd5")).toBe(true)
    expect(looksLikeSan("e8=Q#")).toBe(true)
  })
})
