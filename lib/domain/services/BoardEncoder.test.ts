import { describe, test, expect } from "vitest"
import { encodeBoardSig, PIECE_MAP } from "./BoardEncoder"
import type { BoardArray } from "../types"

describe("BoardEncoder service", () => {
  test("PIECE_MAP has valid entries for all standard pieces", () => {
    expect(PIECE_MAP["wp"]).toBe("P")
    expect(PIECE_MAP["bk"]).toBe("k")
    expect(PIECE_MAP["wq"]).toBe("Q")
    expect(PIECE_MAP["bn"]).toBe("n")
  })

  test("encodeBoardSig serializes 8x8 array into compact signature", () => {
    const emptyBoard: BoardArray = Array.from({ length: 8 }, () => Array(8).fill(null))
    expect(encodeBoardSig(emptyBoard)).toBe(
      "........|........|........|........|........|........|........|........",
    )

    emptyBoard[0][0] = "r"
    emptyBoard[7][4] = "K"
    expect(encodeBoardSig(emptyBoard)).toBe(
      "r.......|........|........|........|........|........|........|....K...",
    )
  })
})
