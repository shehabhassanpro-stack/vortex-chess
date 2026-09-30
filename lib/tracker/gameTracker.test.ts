import { describe, test, expect, beforeEach, vi, type Mock } from "vitest"
import { GameTracker } from "./gameTracker"
import type { IMoveListReader } from "../domain/ports/IMoveListReader"

describe("GameTracker sync()", () => {
  let tracker: GameTracker
  let onWarningSpy: Mock<(msg: string) => void>
  let mockReader: IMoveListReader

  beforeEach(() => {
    onWarningSpy = vi.fn()
    mockReader = {
      findContainer: vi.fn().mockReturnValue(document.createElement("div")),
      extractMoves: vi.fn().mockReturnValue([]),
    }
    tracker = new GameTracker({ onWarning: onWarningSpy, moveListReader: mockReader })
    vi.clearAllMocks()
  })

  test("empty move list → starting position, turn = w", () => {
    vi.mocked(mockReader.extractMoves).mockReturnValue([])

    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    expect(state?.turn).toBe("w")
    expect(state?.plyCount).toBe(0)
  })

  test("replays valid moves and updates fen and turn", () => {
    // e4, e5, Nf3 -> ply count 3, turn black
    vi.mocked(mockReader.extractMoves).mockReturnValue([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "Nf3", raw: "Nf3" },
    ])

    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.turn).toBe("b")
    expect(state?.plyCount).toBe(3)
  })

  test("resilience: handles invalid moves without crashing", () => {
    // The second move "invalid" will fail inside move()
    vi.mocked(mockReader.extractMoves).mockReturnValue([
      { san: "e4", raw: "e4" },
      { san: "invalid", raw: "invalid" },
    ])

    const state = tracker.sync()
    expect(state).toBeNull()
    expect(onWarningSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to replay move [invalid] at ply 2"),
    )
  })

  test("cache invalidated on takeback+new-move at same ply count", () => {
    vi.mocked(mockReader.extractMoves).mockReturnValue([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "Nf3", raw: "Nf3" },
    ])

    const state1 = tracker.sync()
    const fen1 = state1?.fen

    // Takeback Nf3 and play d4 instead
    vi.mocked(mockReader.extractMoves).mockReturnValue([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "d4", raw: "d4" },
    ])

    const state2 = tracker.sync()
    expect(state2?.plyCount).toBe(3)
    expect(state2?.fen).not.toBe(fen1)
  })
})
