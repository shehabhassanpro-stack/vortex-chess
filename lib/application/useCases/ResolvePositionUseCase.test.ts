import { describe, test, expect, vi } from "vitest"
import { ResolvePositionUseCase } from "./ResolvePositionUseCase"
import { DetectActiveColorUseCase } from "./DetectActiveColorUseCase"
import { GameTracker } from "../../tracker/gameTracker"
import type { IBoardReader, BoardReading } from "../../domain/ports/IBoardReader"
import type { IMoveListReader } from "../../domain/ports/IMoveListReader"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"

describe("ResolvePositionUseCase", () => {
  test("resolves normal game from move list via gameTracker", () => {
    const mockBoardReader: IBoardReader = {
      read: vi.fn().mockReturnValue(null),
      checkIsFlipped: vi.fn().mockReturnValue(false),
    }
    const mockMoveListReader: IMoveListReader = {
      findContainer: vi.fn().mockReturnValue(document.createElement("div")),
      extractMoves: vi.fn().mockReturnValue([{ san: "e4", raw: "e4" }]),
    }
    const mockContextProvider: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("computer"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const colorDetector = new DetectActiveColorUseCase([])

    const useCase = new ResolvePositionUseCase(
      mockBoardReader,
      mockMoveListReader,
      mockContextProvider,
      colorDetector,
    )

    const tracker = new GameTracker({ moveListReader: mockMoveListReader })
    const puzzleState = { baseTurn: null, basePlies: -1, settled: false }

    const result = useCase.execute(tracker, puzzleState, "", "unknown")

    expect(result.position).not.toBeNull()
    expect(result.position?.plyCount).toBe(1)
    expect(result.position?.activeColor).toBe("b")
  })

  test("falls back to geometric when no move list is found", () => {
    const emptyBoard = Array.from({ length: 8 }, () => Array(8).fill(null))
    emptyBoard[0][0] = "k"
    emptyBoard[7][4] = "K"

    const mockReading: BoardReading = {
      boardArr: emptyBoard,
      boardEl: document.createElement("div"),
      isFlipped: false,
    }

    const mockBoardReader: IBoardReader = {
      read: vi.fn().mockReturnValue(mockReading),
      checkIsFlipped: vi.fn().mockReturnValue(false),
    }
    const mockMoveListReader: IMoveListReader = {
      findContainer: vi.fn().mockReturnValue(null),
      extractMoves: vi.fn().mockReturnValue([]),
    }
    const mockContextProvider: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("unknown"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const colorDetector = new DetectActiveColorUseCase([
      { name: "test-color", priority: 1, detect: () => "w" },
    ])

    const useCase = new ResolvePositionUseCase(
      mockBoardReader,
      mockMoveListReader,
      mockContextProvider,
      colorDetector,
    )

    const tracker = new GameTracker({ moveListReader: mockMoveListReader })
    const puzzleState = { baseTurn: null, basePlies: -1, settled: false }

    const result = useCase.execute(tracker, puzzleState, "", "unknown")

    expect(result.position).not.toBeNull()
    expect(result.position?.source).toBe("geometric")
    expect(result.position?.activeColor).toBe("w")
  })
})
