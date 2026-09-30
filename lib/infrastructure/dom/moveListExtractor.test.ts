import { describe, test, expect } from "vitest"
import { normaliseSan, looksLikeSan, extractSanMoves } from "./moveListExtractor"

describe("moveListExtractor", () => {
  describe("normaliseSan", () => {
    test("should strip move numbers", () => {
      expect(normaliseSan("12. e4")).toBe("e4")
      expect(normaliseSan("12... e5")).toBe("e5")
    })

    test("should strip annotation symbols", () => {
      expect(normaliseSan("Nf3!!")).toBe("Nf3")
      expect(normaliseSan("Bc4?!")).toBe("Bc4")
      expect(normaliseSan("O-O $1")).toBe("O-O")
    })

    test("should keep valid SAN characters including capture and check/mate", () => {
      expect(normaliseSan("exd5")).toBe("exd5")
      expect(normaliseSan("Bxf7+")).toBe("Bxf7+")
      expect(normaliseSan("Qh5#")).toBe("Qh5#")
      expect(normaliseSan("O-O-O")).toBe("O-O-O")
      expect(normaliseSan("c8=Q")).toBe("c8=Q")
    })

    test("should ignore game results", () => {
      expect(normaliseSan("1-0")).toBe("")
      expect(normaliseSan("0-1")).toBe("")
      expect(normaliseSan("1/2-1/2")).toBe("")
    })
  })

  describe("looksLikeSan", () => {
    test("should validate standard moves", () => {
      expect(looksLikeSan("e4")).toBe(true)
      expect(looksLikeSan("Nf3")).toBe(true)
      expect(looksLikeSan("O-O")).toBe(true)
    })

    test("should reject pure numbers and move prefixes", () => {
      expect(looksLikeSan("12")).toBe(false)
      expect(looksLikeSan("12.")).toBe(false)
      expect(looksLikeSan("1...")).toBe(false)
    })

    test("should reject empty or extremely short/long strings", () => {
      expect(looksLikeSan("")).toBe(false)
      expect(looksLikeSan("e")).toBe(false)
      expect(looksLikeSan("e4e5Nf3Nc6")).toBe(false)
    })
  })

  describe("extractSanMoves", () => {
    test("should extract plain text nodes properly", () => {
      const container = document.createElement("div")
      container.innerHTML = `
        <div class="node"><span class="node-highlight-content">e4</span></div>
        <div class="node"><span class="node-highlight-content">e5</span></div>
      `
      const moves = extractSanMoves(container)
      expect(moves).toHaveLength(2)
      expect(moves[0].san).toBe("e4")
      expect(moves[1].san).toBe("e5")
    })

    test("should extract moves with figurine notation", () => {
      const container = document.createElement("div")
      container.innerHTML = `
        <div class="node">
          <span class="node-highlight-content">
            <span data-figurine="N" class="icon-font-chess knight-white"></span>f3
          </span>
        </div>
      `
      const moves = extractSanMoves(container)
      expect(moves).toHaveLength(1)
      expect(moves[0].san).toBe("Nf3")
    })

    test("should extract moves from raw text fallback if no selectors match", () => {
      const container = document.createElement("div")
      // An unknown structure
      container.innerHTML = `
        <span>1. e4</span> <span>e5</span> <span>2. Nf3</span> <span>Nc6</span>
      `
      const moves = extractSanMoves(container)
      expect(moves).toHaveLength(4)
      expect(moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6"])
    })
  })
})
