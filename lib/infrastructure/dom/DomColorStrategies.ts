import type {
  IColorDetectionStrategy,
  ColorDetectionContext,
} from "../../domain/ports/IColorDetectionStrategy"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { ActiveColor } from "../../domain/types"
import { encodeBoardSig } from "../../domain/services/BoardEncoder"
import { BOARD_SELECTORS, PUZZLE_TEXT_SELECTORS } from "./selectors"

/** Strategy 1 — reads which player clock is active in the DOM */
export class ClockStrategy implements IColorDetectionStrategy {
  readonly name = "clock"
  readonly priority = 1

  detect(_ctx: ColorDetectionContext): ActiveColor | null {
    if (document.querySelector(BOARD_SELECTORS.CLOCK_BLACK)) return "b"
    if (document.querySelector(BOARD_SELECTORS.CLOCK_WHITE)) return "w"
    return null
  }
}

/** Strategy 2 — if board layout changed, the opposite player just moved */
export class BoardDiffStrategy implements IColorDetectionStrategy {
  readonly name = "diff"
  readonly priority = 2

  detect(ctx: ColorDetectionContext): ActiveColor | null {
    const { boardArr, prevBoardSig, prevTurn } = ctx
    if (!prevBoardSig || prevTurn === "unknown") return null
    const currentSig = encodeBoardSig(boardArr)
    return currentSig !== prevBoardSig ? (prevTurn === "w" ? "b" : "w") : prevTurn
  }
}

/** Strategy 3 — reads 'White/Black to move' text from puzzle container */
export class PuzzleTextStrategy implements IColorDetectionStrategy {
  readonly name = "puzzle-text"
  readonly priority = 3

  detect(_ctx: ColorDetectionContext): ActiveColor | null {
    const puzzleElements = document.querySelectorAll(PUZZLE_TEXT_SELECTORS)
    for (const el of Array.from(puzzleElements)) {
      const text = el.textContent?.toLowerCase() || ""
      if (
        text.includes("white to move") ||
        text.includes("move for white") ||
        text.includes("white's turn")
      ) {
        return "w"
      }
      if (
        text.includes("black to move") ||
        text.includes("move for black") ||
        text.includes("black's turn")
      ) {
        return "b"
      }
    }
    return null
  }
}

/** Strategy 4 — infers turn from board orientation (puzzle/analysis pages only) */
export class OrientationStrategy implements IColorDetectionStrategy {
  readonly name = "orientation"
  readonly priority = 4

  constructor(private readonly contextProvider: IGameContextProvider) {}

  detect(ctx: ColorDetectionContext): ActiveColor | null {
    const context = this.contextProvider.getContext()
    if (context === "puzzle" || context === "analysis") {
      return ctx.isFlipped ? "b" : "w"
    }
    return null
  }
}

/** Strategy 5 — heuristic piece count difference (unreliable last-resort fallback) */
export class PieceCountStrategy implements IColorDetectionStrategy {
  readonly name = "piece-count"
  readonly priority = 5

  detect(ctx: ColorDetectionContext): ActiveColor | null {
    let whiteCount = 0
    let blackCount = 0

    ctx.boardArr.forEach((row) =>
      row.forEach((p) => {
        if (!p) return
        if (p === p.toUpperCase()) whiteCount++
        else blackCount++
      }),
    )

    if (whiteCount === blackCount) return null
    return whiteCount < blackCount ? "w" : "b"
  }
}
