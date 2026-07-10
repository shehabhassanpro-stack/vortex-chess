/**
 * Chess Helper AI — GameTracker
 *
 * Primary FEN source for Chess.com. Reads the move list from the DOM,
 * replays every move on a chess.js Chess instance, and exposes a fully
 * correct FEN string — including castling rights, en passant square,
 * halfmove clock, and active color.
 *
 * Fallback: if the move list is empty or unreadable (e.g. Puzzles with
 * no visible history), callers should use the geometric extractor.
 * The geometric board can also be used to *validate* the chess.js state.
 */

import { Chess } from "chess.js"

// ─── Types ────────────────────────────────────────────────────────────

export interface TrackerState {
  /** Fully correct FEN including castling, en passant, counters. */
  fen: string
  /** Whose turn it is. */
  turn: "w" | "b"
  /** How many half-moves (plies) have been played. */
  plyCount: number
  /** Source used to produce the FEN. */
  source: "chess.js" | "geometric-fallback"
}

export interface GameTrackerOptions {
  /** Called with a warning message when fallback is used or sync fails. */
  onWarning?: (msg: string) => void
}

// ─── DOM Selectors ────────────────────────────────────────────────────

/**
 * Ordered list of CSS selectors tried to find the move-list container.
 * Chess.com has changed these over time; we try them all.
 */
const MOVE_LIST_SELECTORS = [
  "wc-simple-move-list",        // newer SPA component (2024+)
  "vertical-move-list",         // classic
  ".move-list-wrapper",         // older wrapper
  "chess-moves-simple",         // embedded boards
  "[data-cy='move-list']",      // data-cy attribute variant
  ".moves-wrapper",
  "rml",                        // rapid move list
] as const

/**
 * Within the move list element, find individual move nodes.
 */
const MOVE_NODE_SELECTORS = [
  ".node .node-highlight-content",  // 2024+ SPA: text inside highlight span
  ".node",                          // 2024+ SPA: full node
  "vertical-move-list .node",       // classic
  ".move-list-wrapper .move",
  "[data-movelistsquare]",
  ".main-line-ply",
  ".move-san",
] as const

// ─── SAN Normalisation ───────────────────────────────────────────────

/**
 * Chess.com annotates moves with !, ?, !?, ?!, !!, ?? and Unicode.
 * Strip everything except valid SAN characters.
 */
function normaliseSan(raw: string): string {
  return raw
    .replace(/[!?]/g, "")          // annotation glyphs
    .replace(/\$\d+/g, "")         // PGN NAG codes
    .replace(/[^\w\-=+#]/g, "")    // keep only SAN-valid characters
    .trim()
}

// ─── Move List Extraction ─────────────────────────────────────────────

function findMoveListElement(): Element | null {
  for (const sel of MOVE_LIST_SELECTORS) {
    const el = document.querySelector(sel)
    if (el) return el
  }
  return null
}

/**
 * Extract SAN strings from the move list container.
 * Returns an empty array when nothing is found.
 */
function extractSanMoves(container: Element): string[] {
  // Strategy A: structured node selectors (most reliable)
  for (const sel of MOVE_NODE_SELECTORS) {
    const nodes = container.querySelectorAll(sel)
    if (nodes.length > 0) {
      const sans: string[] = []
      for (const node of Array.from(nodes)) {
        const text = node.textContent?.trim() ?? ""
        if (!text) continue
        // Skip move numbers like "1.", "2.", "10."
        if (/^\d+\.?$/.test(text)) continue
        const san = normaliseSan(text)
        // Basic sanity: SAN moves are 2–7 characters
        if (san.length >= 2 && san.length <= 7) sans.push(san)
      }
      if (sans.length > 0) return sans
    }
  }

  // Strategy B: parse raw text content as fallback
  const raw = container.textContent ?? ""
  return raw
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .filter((t) => !/^\d+\.?$/.test(t))
    .map(normaliseSan)
    .filter((t) => t.length >= 2 && t.length <= 7)
}

// ─── GameTracker Class ────────────────────────────────────────────────

export class GameTracker {
  private chess: Chess
  private lastMoveCount = -1
  private lastFen = ""
  private readonly options: GameTrackerOptions

  constructor(options: GameTrackerOptions = {}) {
    this.chess = new Chess()
    this.options = options
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Synchronise the internal Chess instance with the DOM move list.
   *
   * Returns a TrackerState on success, or null when the move list is
   * unavailable — the caller must then fall back to geometric extraction.
   */
  sync(): TrackerState | null {
    const container = findMoveListElement()
    if (!container) {
      this.warn("No move list element found — geometric fallback required")
      return null
    }

    const sans = extractSanMoves(container)

    if (sans.length === 0) {
      // Empty move list = starting position or puzzle without history
      this.warn("Move list is empty — geometric fallback required")
      return null
    }

    // Skip full replay if move count hasn't changed (optimisation)
    if (sans.length === this.lastMoveCount && this.lastFen) {
      return {
        fen: this.lastFen,
        turn: this.chess.turn(),
        plyCount: sans.length,
        source: "chess.js",
      }
    }

    // Replay all moves from scratch to handle takeback/undo correctly
    const ok = this.replayMoves(sans)
    if (!ok) return null  // Corrupt PGN — caller uses fallback

    this.lastMoveCount = sans.length
    this.lastFen = this.chess.fen()

    return {
      fen: this.lastFen,
      turn: this.chess.turn(),
      plyCount: sans.length,
      source: "chess.js",
    }
  }

  /**
   * Compare piece layout of chess.js FEN against a geometrically-extracted FEN.
   * Only the board part (segment 0) is compared — ignores counters.
   *
   * Returns true  → positions match (chess.js state is reliable).
   * Returns false → positions diverge (should force resync from geometric).
   */
  validateAgainstGeometric(geometricFen: string): boolean {
    if (!this.lastFen || !geometricFen) return true
    const cjBoard  = this.lastFen.split(" ")[0]
    const geoBoard = geometricFen.split(" ")[0]
    const match = cjBoard === geoBoard
    if (!match) {
      this.warn(
        `Board mismatch: chess.js="${cjBoard}" geometric="${geoBoard}" — will resync`
      )
    }
    return match
  }

  /**
   * Reset state completely — call on new game or SPA navigation.
   */
  reset(): void {
    this.chess = new Chess()
    this.lastMoveCount = -1
    this.lastFen = ""
  }

  getLastFen(): string {
    return this.lastFen
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  /**
   * Replay SAN moves on a fresh Chess instance.
   * Returns false if any move is illegal.
   */
  private replayMoves(sans: string[]): boolean {
    const fresh = new Chess()

    for (const san of sans) {
      try {
        const result = fresh.move(san)
        if (result === null) {
          this.warn(`Illegal move during replay: "${san}"`)
          return false
        }
      } catch {
        this.warn(`chess.js exception on move "${san}"`)
        return false
      }
    }

    this.chess = fresh
    return true
  }

  private warn(msg: string): void {
    console.warn("[ChessHelper:GameTracker]", msg)
    this.options.onWarning?.(msg)
  }
}
