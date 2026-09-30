/**
 * Chess Helper AI — GameTracker
 *
 * Primary FEN source for Chess.com. Reads the move list from the DOM reader,
 * replays moves using MoveReplayer, and exposes a fully correct FEN string.
 */

import { Chess } from "chess.js"
import { dbg } from "../core/debug"
import type { IMoveListReader, SanMove } from "../domain/ports/IMoveListReader"
import { MoveReplayer } from "../domain/services/MoveReplayer"
import { ChessComMoveListAdapter } from "../infrastructure/adapters/ChessComMoveListAdapter"

// ─── Types ────────────────────────────────────────────────────────────────

export interface TrackerState {
  /** Fully correct FEN including castling, en passant, counters. */
  fen: string
  /** Whose turn it is — always from chess.js, never from heuristics. */
  turn: "w" | "b"
  /** How many half-moves (plies) have been played. */
  plyCount: number
  /** Source used to produce the FEN. */
  source: "chess.js"
}

export interface GameTrackerOptions {
  onWarning?: (msg: string) => void
  moveListReader?: IMoveListReader
}

// ─── GameTracker ──────────────────────────────────────────────────────────

export class GameTracker {
  private chess: Chess
  private lastMoveCount = -1
  private lastMoveSig = "" // last-SAN cache key
  private lastFen = ""
  private failedReplayCount = 0
  private lastMissingListWarnTime = 0
  private readonly moveListReader: IMoveListReader
  private readonly moveReplayer: MoveReplayer
  private readonly options: GameTrackerOptions

  constructor(options: GameTrackerOptions = {}) {
    this.chess = new Chess()
    this.options = options
    this.moveListReader = options.moveListReader ?? new ChessComMoveListAdapter()
    this.moveReplayer = new MoveReplayer({
      onWarning: (msg) => this.warn(msg),
    })
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Used exclusively by the Puzzle Ply-Tracking strategy to get the current
   * number of half-moves without attempting to replay them from startpos.
   */
  extractPliesCountOnly(): number {
    const container = this.moveListReader.findContainer()
    if (!container) return 0
    return this.moveListReader.extractMoves(container).length
  }

  /**
   * Synchronise with the DOM move list.
   *
   * Returns TrackerState on success.
   * Returns null ONLY when no move list element exists (caller uses geometric).
   */
  sync(): TrackerState | null {
    const container = this.moveListReader.findContainer()

    // No move-list element at all (e.g. /puzzles) → caller uses geometric
    if (!container) {
      const now = Date.now()
      if (now - this.lastMissingListWarnTime > 30000) {
        this.warn("No move list element — caller should use geometric fallback")
        this.lastMissingListWarnTime = now
      }
      return null
    }

    const moves = this.moveListReader.extractMoves(container)
    const sans = moves.map((m) => m.san)
    const lastSan = sans.length > 0 ? sans[sans.length - 1] : "none"
    dbg(
      "GameTracker",
      `[FEN-SOURCE] [${new Date().toISOString()}] movelist — ${sans.length} moves | last: ${lastSan}`,
    )

    // Starting position (0 moves played)
    if (sans.length === 0) {
      const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      dbg("GameTracker", "[FEN-SOURCE] Empty move list → starting position, turn=w")
      return { fen: startFen, turn: "w", plyCount: 0, source: "chess.js" }
    }

    const cachedState = this.checkCache(sans)
    if (cachedState) return cachedState

    return this.performFullReplay(moves)
  }

  /**
   * Validate piece layout of chess.js FEN against a geometric FEN.
   * Only compares board layout (segment 0), ignoring active color and counters.
   */
  validateAgainstGeometric(geometricFen: string): boolean {
    if (!this.lastFen || !geometricFen) return true
    const cjBoard = this.lastFen.split(" ")[0]
    const geoBoard = geometricFen.split(" ")[0]
    if (cjBoard !== geoBoard) {
      this.warn(`Board mismatch: chess.js="${cjBoard}" | geometric="${geoBoard}"`)
      return false
    }
    return true
  }

  reset(): void {
    this.chess = new Chess()
    this.moveReplayer.reset()
    this.lastMoveCount = -1
    this.lastMoveSig = ""
    this.lastFen = ""
    dbg("GameTracker", "GameTracker reset")
  }

  getLastFen(): string {
    return this.lastFen
  }
  getLastTurn(): "w" | "b" {
    return this.chess.turn()
  }

  // ── Private ────────────────────────────────────────────────────────────

  private checkCache(sans: string[]): TrackerState | null {
    const moveSig = `${sans.length}:${sans[sans.length - 1]}`
    if (moveSig === this.lastMoveSig && this.lastFen) {
      dbg("GameTracker", `[FEN-SOURCE] Cache hit (sig="${moveSig}") → turn=${this.chess.turn()}`)
      return {
        fen: this.lastFen,
        turn: this.chess.turn(),
        plyCount: sans.length,
        source: "chess.js",
      }
    }
    return null
  }

  private performFullReplay(moves: SanMove[]): TrackerState | null {
    const replayResult = this.moveReplayer.replay(moves)
    if (!replayResult) {
      this.failedReplayCount++
      if (this.failedReplayCount >= 2) {
        console.warn(
          "[ChessHelper:GameTracker] Persistent replay failure. Selector or parsing may be broken.",
        )
      }
      return null
    }

    this.chess = replayResult.chess
    this.failedReplayCount = 0
    const sans = moves.map((m) => m.san)
    this.lastMoveCount = sans.length
    this.lastMoveSig = `${sans.length}:${sans[sans.length - 1]}`
    this.lastFen = replayResult.fen

    dbg(
      "GameTracker",
      `[FEN-SOURCE] Replayed ${sans.length} moves → turn=${this.chess.turn()} FEN="${this.lastFen}"`,
    )

    return {
      fen: this.lastFen,
      turn: this.chess.turn(),
      plyCount: sans.length,
      source: "chess.js",
    }
  }

  private warn(msg: string): void {
    console.warn("[ChessHelper:GameTracker]", msg)
    this.options.onWarning?.(msg)
  }
}
