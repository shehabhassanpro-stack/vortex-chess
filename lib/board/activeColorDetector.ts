/**
 * Chess Helper AI — Active Color Detector
 *
 * Determines whose turn it is using a cascading chain of strategies,
 * from most reliable (clock DOM) to least reliable (piece count heuristic).
 *
 * Strategy priority:
 *   1. Clock element presence (most reliable)
 *   2. Board diff vs. last known state
 *   3. Puzzle text ("White to move")
 *   4. Board orientation (puzzle/analysis only)
 *   5. Piece count heuristic (unreliable fallback)
 */

import { CHESS_COM_SELECTORS } from "../core/constants"
import { encodeBoardSig } from "./boardExtractor"
import { getGameContext } from "../core/gameContext"
import type { BoardArray, ActiveColor, TurnResult } from "../core/types"

// ─── Individual Strategies ─────────────────────────────────────────────────

/** Strategy 1 — reads which clock is ticking. */
export function detectByClock(): ActiveColor | null {
  if (document.querySelector(CHESS_COM_SELECTORS.CLOCK_BLACK)) return "b"
  if (document.querySelector(CHESS_COM_SELECTORS.CLOCK_WHITE)) return "w"
  return null
}

/** Strategy 2 — if the board changed since last call, the previous player just moved. */
export function detectByDiff(
  boardArr: BoardArray,
  prevSig: string,
  prevTurn: ActiveColor | "unknown",
): ActiveColor | null {
  if (!prevSig || prevTurn === "unknown") return null
  const currentSig = encodeBoardSig(boardArr)
  return currentSig !== prevSig ? (prevTurn === "w" ? "b" : "w") : prevTurn
}

/** Strategy 3 — reads "White/Black to move" puzzle text from the DOM. */
export function detectByPuzzleText(): ActiveColor | null {
  const puzzleElements = document.querySelectorAll(
    '.message-component, .puzzle-message-component, h3, .status-title, .title-text, [data-cy="turn-indicator"]',
  )
  for (const el of Array.from(puzzleElements)) {
    const text = el.textContent?.toLowerCase() || ""
    if (
      text.includes("white to move") ||
      text.includes("move for white") ||
      text.includes("white's turn")
    )
      return "w"
    if (
      text.includes("black to move") ||
      text.includes("move for black") ||
      text.includes("black's turn")
    )
      return "b"
  }
  return null
}

/** Strategy 4 — infers turn from board orientation (reliable only on puzzle/analysis pages). */
export function detectByOrientation(isFlipped: boolean): ActiveColor | null {
  const context = getGameContext()
  if (context === "puzzle" || context === "analysis") return isFlipped ? "b" : "w"
  return null
}

/** Strategy 5 — piece count heuristic (unreliable; used only as last resort). */
export function detectByPieceCount(boardArr: BoardArray): ActiveColor | "unknown" {
  let whiteCount = 0
  let blackCount = 0
  boardArr.forEach((row) =>
    row.forEach((p) => {
      if (!p) return
      if (p === p.toUpperCase()) whiteCount++
      else blackCount++
    }),
  )
  if (whiteCount === blackCount) return "unknown"
  // The side with fewer pieces is likely to be the active player
  // (they most recently captured something — heuristic only)
  return whiteCount < blackCount ? "w" : "b"
}

// ─── Composite: Geometric Fallback ─────────────────────────────────────────

/**
 * Determine the active color using the geometric fallback path.
 * Tries strategies 1–5 in order and returns the first reliable result.
 *
 * @param boardArr  - Current 8×8 board array
 * @param prevSig   - Encoded board signature from the previous frame
 * @param prevTurn  - Active color from the previous frame
 * @param isFlipped - Whether the board is displayed with Black at the bottom
 */
export function detectActiveColorGeometric(
  boardArr: BoardArray,
  prevSig: string,
  prevTurn: ActiveColor | "unknown",
  isFlipped: boolean,
): TurnResult {
  let result = detectByClock()
  if (result) return { turn: result, reliable: true }

  result = detectByDiff(boardArr, prevSig, prevTurn)
  if (result) return { turn: result, reliable: true }

  result = detectByPuzzleText()
  if (result) return { turn: result, reliable: true }

  result = detectByOrientation(isFlipped)
  if (result) return { turn: result, reliable: true }

  const fallback = detectByPieceCount(boardArr)
  return { turn: fallback, reliable: false }
}

// ─── Puzzle Ply-Tracking ────────────────────────────────────────────────────

export interface PuzzleState {
  baseTurn: ActiveColor | null
  basePlies: number
  settled: boolean
}

/**
 * Resolve the active color for puzzles using ply-tracking.
 *
 * Two modes:
 *   - hasMovelist=true: Track plies from a stable base snapshot (Mod 1)
 *   - hasMovelist=false: Use static text/orientation cues only (Mod 2)
 *
 * @param hasMovelist      - Whether a move-list element was found
 * @param isFlipped        - Whether the board is flipped
 * @param currentPlies     - Current number of half-moves in the move list
 * @param puzzleState      - Mutable state object (modified in-place)
 * @param detectText       - Injected strategy-3 function (testable)
 * @param detectOrientation - Injected strategy-4 function (testable)
 */
export function resolvePuzzleTurn(
  hasMovelist: boolean,
  isFlipped: boolean,
  currentPlies: number,
  puzzleState: PuzzleState,
  detectText: () => ActiveColor | null,
  detectOrientation: (flipped: boolean) => ActiveColor | null,
): { turn: ActiveColor | "unknown"; turnSrc: string } {
  let turn: ActiveColor | "unknown" = "unknown"
  let turnSrc = ""

  if (hasMovelist) {
    if (!puzzleState.settled) {
      // Mod 1: Atomic Snapshot — read baseTurn and basePlies together.
      const baseTurn = detectText() || detectOrientation(isFlipped)
      if (baseTurn) {
        puzzleState.baseTurn = baseTurn
        puzzleState.basePlies = currentPlies
        puzzleState.settled = true
      }
    }

    if (puzzleState.settled) {
      const diff = currentPlies - puzzleState.basePlies
      turn = diff % 2 === 0 ? puzzleState.baseTurn! : puzzleState.baseTurn === "w" ? "b" : "w"
      turnSrc = "ply-tracking"
    }
  } else {
    // Mod 2: No move list — use static cues only; never fall back to diff.
    turn = detectText() || detectOrientation(isFlipped) || "unknown"
    turnSrc = "static-puzzle-cues"
    puzzleState.settled = true
  }

  return { turn, turnSrc }
}
