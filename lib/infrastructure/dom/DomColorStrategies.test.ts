import { describe, test, expect, beforeEach, vi } from "vitest"
import {
  ClockStrategy,
  BoardDiffStrategy,
  PuzzleTextStrategy,
  OrientationStrategy,
  PieceCountStrategy,
} from "./DomColorStrategies"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { BoardArray } from "../../domain/types"

describe("DomColorStrategies", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("ClockStrategy detects white and black ticking clocks", () => {
    const strategy = new ClockStrategy()
    const ctx = {
      boardArr: [],
      prevBoardSig: "",
      prevTurn: "unknown" as const,
      isFlipped: false,
    }

    expect(strategy.detect(ctx)).toBeNull()

    document.body.innerHTML = '<div class="clock-white clock-player-turn"></div>'
    expect(strategy.detect(ctx)).toBe("w")

    document.body.innerHTML = '<div class="clock-black clock-player-turn"></div>'
    expect(strategy.detect(ctx)).toBe("b")
  })

  test("BoardDiffStrategy flips turn when board signature changed", () => {
    const strategy = new BoardDiffStrategy()
    const board1: BoardArray = Array.from({ length: 8 }, () => Array(8).fill(null))
    board1[0][0] = "r"
    const prevSig = "........|........|........|........|........|........|........|........"

    const ctx = {
      boardArr: board1,
      prevBoardSig: prevSig,
      prevTurn: "w" as const,
      isFlipped: false,
    }

    expect(strategy.detect(ctx)).toBe("b") // changed -> flips from w to b
  })

  test("PuzzleTextStrategy extracts turn from DOM text hints", () => {
    const strategy = new PuzzleTextStrategy()
    const ctx = {
      boardArr: [],
      prevBoardSig: "",
      prevTurn: "unknown" as const,
      isFlipped: false,
    }

    document.body.innerHTML = '<div class="message-component">White to move</div>'
    expect(strategy.detect(ctx)).toBe("w")

    document.body.innerHTML = '<div class="status-title">Black to move</div>'
    expect(strategy.detect(ctx)).toBe("b")
  })

  test("OrientationStrategy respects context and isFlipped", () => {
    const mockContext = {
      getContext: vi.fn().mockReturnValue("puzzle"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    } satisfies IGameContextProvider

    const strategy = new OrientationStrategy(mockContext)
    const ctx = {
      boardArr: [],
      prevBoardSig: "",
      prevTurn: "unknown" as const,
      isFlipped: true,
    }

    expect(strategy.detect(ctx)).toBe("b")

    mockContext.getContext.mockReturnValue("live")
    expect(strategy.detect(ctx)).toBeNull() // not applicable for live
  })

  test("PieceCountStrategy returns side with fewer pieces or null if tied", () => {
    const strategy = new PieceCountStrategy()
    const board: BoardArray = Array.from({ length: 8 }, () => Array(8).fill(null))
    board[0][0] = "k"
    board[7][7] = "K"

    const ctx = {
      boardArr: board,
      prevBoardSig: "",
      prevTurn: "unknown" as const,
      isFlipped: false,
    }

    expect(strategy.detect(ctx)).toBeNull() // 1 white, 1 black -> tied

    board[7][6] = "Q" // 2 white, 1 black -> black has fewer
    expect(strategy.detect(ctx)).toBe("b")
  })
})
