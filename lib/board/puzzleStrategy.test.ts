import { describe, test, expect } from "vitest"
import { resolvePuzzleTurn } from "./activeColorDetector"
import { getHeuristicCastling } from "./fenBuilder"

describe("resolvePuzzleTurn", () => {
  test("Atomic Snapshot: reads base turn and plies together", () => {
    const puzzleState = { baseTurn: null, basePlies: -1, settled: false }
    const detectText = () => "w" as const
    const detectOrientation = () => "b" as const

    const result = resolvePuzzleTurn(true, false, 5, puzzleState, detectText, detectOrientation)

    // Check it read them atomically
    expect(puzzleState.settled).toBe(true)
    expect(puzzleState.baseTurn).toBe("w")
    expect(puzzleState.basePlies).toBe(5)

    // Output should match since diff is 0
    expect(result.turn).toBe("w")
    expect(result.turnSrc).toBe("ply-tracking")
  })

  test("Missing Movelist: never falls back to diff, evaluates text/orientation, stays standby if missing", () => {
    const puzzleState = { baseTurn: null, basePlies: -1, settled: false }

    // 1. Text/Orientation missing
    const res1 = resolvePuzzleTurn(
      false,
      false,
      5,
      puzzleState,
      () => null,
      () => null,
    )
    expect(puzzleState.settled).toBe(true)
    expect(res1.turn).toBe("unknown")
    expect(res1.turnSrc).toBe("static-puzzle-cues")

    // 2. Text exists
    const puzzleState2 = { baseTurn: null, basePlies: -1, settled: false }
    const res2 = resolvePuzzleTurn(
      false,
      false,
      5,
      puzzleState2,
      () => "b",
      () => "w",
    )
    expect(puzzleState2.settled).toBe(true)
    expect(res2.turn).toBe("b")
  })

  test("Double-ply Fast Opponent Reply", () => {
    // User is white. State is settled.
    const puzzleState = { baseTurn: "w" as const, basePlies: 2, settled: true }

    // User plays move (+1 ply), Opponent replies instantly (+1 ply). Observer fires -> currentPlies = 4
    const diffPlies = 4 // (2 from before + 2 new half-moves)
    const result = resolvePuzzleTurn(
      true,
      false,
      diffPlies,
      puzzleState,
      () => null,
      () => "w",
    )

    // 4 - 2 = 2 % 2 === 0 -> baseTurn remains w!
    expect(result.turn).toBe("w")
    expect(result.turnSrc).toBe("ply-tracking")
  })
})

describe("getHeuristicCastling", () => {
  test("Full rights if in standard positions", () => {
    const board = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null))
    board[7][4] = "K"
    board[7][7] = "R"
    board[7][0] = "R" // White
    board[0][4] = "k"
    board[0][7] = "r"
    board[0][0] = "r" // Black
    expect(getHeuristicCastling(board)).toBe("KQkq")
  })

  test("Missing rights if moved", () => {
    const board = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null))
    board[7][4] = "K"
    board[7][7] = "R" // Missing queenside rook
    board[0][4] = null // King moved
    expect(getHeuristicCastling(board)).toBe("K")
  })
})
