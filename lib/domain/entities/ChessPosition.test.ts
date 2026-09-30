import { describe, test, expect } from "vitest"
import { ChessPosition } from "./ChessPosition"

describe("ChessPosition entity", () => {
  test("startingPosition creates valid white start position", () => {
    const pos = ChessPosition.startingPosition()
    expect(pos.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    expect(pos.activeColor).toBe("w")
    expect(pos.source).toBe("chess.js")
    expect(pos.plyCount).toBe(0)
    expect(pos.isStarting()).toBe(true)
  })

  test("fromFen extracts activeColor correctly", () => {
    const posWhite = ChessPosition.fromFen(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "chess.js",
      1,
    )
    expect(posWhite.activeColor).toBe("b")
    expect(posWhite.plyCount).toBe(1)
    expect(posWhite.isStarting()).toBe(false)
  })

  test("equals returns true only when FEN matches", () => {
    const p1 = ChessPosition.fromFen("8/8/8/8/8/8/8/8 w - - 0 1", "geometric")
    const p2 = ChessPosition.fromFen("8/8/8/8/8/8/8/8 w - - 0 1", "chess.js")
    const p3 = ChessPosition.fromFen("8/8/8/8/8/8/8/8 b - - 0 1", "geometric")

    expect(p1.equals(p2)).toBe(true)
    expect(p1.equals(p3)).toBe(false)
    expect(p1.equals(null)).toBe(false)
  })
})
