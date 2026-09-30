import { describe, test, expect, beforeEach, vi } from "vitest"
import { ResolvePositionUseCase } from "../../lib/application/useCases/ResolvePositionUseCase"
import { DetectActiveColorUseCase } from "../../lib/application/useCases/DetectActiveColorUseCase"
import {
  ClockStrategy,
  BoardDiffStrategy,
  PuzzleTextStrategy,
  OrientationStrategy,
  PieceCountStrategy,
} from "../../lib/infrastructure/dom/DomColorStrategies"
import { GameTracker } from "../../lib/tracker/gameTracker"
import type { IBoardReader, BoardReading } from "../../lib/domain/ports/IBoardReader"
import type { IMoveListReader } from "../../lib/domain/ports/IMoveListReader"
import type { IGameContextProvider } from "../../lib/domain/ports/IGameContextProvider"
import type { BoardArray } from "../../lib/domain/types"

describe("Integration: Position Resolution Cascade", () => {
  let mockBoardReader: IBoardReader
  let mockMoveListReader: IMoveListReader
  let mockContextProvider: IGameContextProvider
  let resolvePositionUseCase: ResolvePositionUseCase

  beforeEach(() => {
    document.body.innerHTML = ""

    mockBoardReader = {
      read: vi.fn(),
      checkIsFlipped: vi.fn().mockReturnValue(false),
    }
    mockMoveListReader = {
      findContainer: vi.fn(),
      extractMoves: vi.fn(),
    }
    mockContextProvider = {
      getContext: vi.fn().mockReturnValue("computer"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }

    const strategies = [
      new ClockStrategy(),
      new BoardDiffStrategy(),
      new PuzzleTextStrategy(),
      new OrientationStrategy(mockContextProvider),
      new PieceCountStrategy(),
    ]
    const colorDetector = new DetectActiveColorUseCase(strategies)

    resolvePositionUseCase = new ResolvePositionUseCase(
      mockBoardReader,
      mockMoveListReader,
      mockContextProvider,
      colorDetector,
    )
  })

  test("End-to-End: Standard game with move list produces accurate chess.js FEN", () => {
    vi.mocked(mockMoveListReader.findContainer).mockReturnValue(document.createElement("div"))
    vi.mocked(mockMoveListReader.extractMoves).mockReturnValue([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "Nf3", raw: "Nf3" },
      { san: "Nc6", raw: "Nc6" },
      { san: "Bb5", raw: "Bb5" }, // Ruy Lopez
    ])

    const tracker = new GameTracker({ moveListReader: mockMoveListReader })
    const puzzleState = { baseTurn: null, basePlies: -1, settled: false }

    const result = resolvePositionUseCase.execute(tracker, puzzleState, "", "unknown")

    expect(result.position).not.toBeNull()
    expect(result.position?.source).toBe("chess.js")
    expect(result.position?.plyCount).toBe(5)
    expect(result.position?.activeColor).toBe("b")
    expect(result.position?.fen).toContain(
      "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -",
    )
  })

  test("End-to-End: Fallback to geometric with Clock DOM strategy when move list is unavailable", () => {
    vi.mocked(mockMoveListReader.findContainer).mockReturnValue(null)
    vi.mocked(mockContextProvider.getContext).mockReturnValue("unknown")

    const startBoard: BoardArray = [
      ["r", "n", "b", "q", "k", "b", "n", "r"],
      ["p", "p", "p", "p", "p", "p", "p", "p"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, "P", null, null, null], // 1. e4
      [null, null, null, null, null, null, null, null],
      ["P", "P", "P", "P", null, "P", "P", "P"],
      ["R", "N", "B", "Q", "K", "B", "N", "R"],
    ]

    const reading: BoardReading = {
      boardArr: startBoard,
      boardEl: document.createElement("div"),
      isFlipped: false,
    }
    vi.mocked(mockBoardReader.read).mockReturnValue(reading)

    // Clock indicates it's Black's turn
    document.body.innerHTML = '<div class="clock-black clock-player-turn"></div>'

    const tracker = new GameTracker({ moveListReader: mockMoveListReader })
    const puzzleState = { baseTurn: null, basePlies: -1, settled: false }

    const result = resolvePositionUseCase.execute(tracker, puzzleState, "", "unknown")

    expect(result.position).not.toBeNull()
    expect(result.position?.source).toBe("geometric")
    expect(result.position?.activeColor).toBe("b")
    expect(result.traceMeta.turnSrc).toBe("geometric-strategies")
  })
})
