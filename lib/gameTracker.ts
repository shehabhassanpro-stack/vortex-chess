/**
 * Chess Helper AI — GameTracker  (v2 — Active Color fix)
 *
 * Primary FEN source for Chess.com. Reads the move list from the DOM,
 * replays every move on a chess.js Chess instance, and exposes a fully
 * correct FEN string — including castling rights, en passant square,
 * halfmove clock, and active color.
 *
 * v2 changes:
 *   - Improved move node extraction for Chess.com /analysis and /puzzles
 *   - Cache invalidation uses last-SAN comparison, not just move count
 *     (prevents stale cache when takeback+new move = same ply count)
 *   - Empty move list on starting position now returns "w" FEN directly
 *   - Diagnostic logging behind DEBUG_CHESS_HELPER flag
 */

import { Chess } from "chess.js"

// ─── Debug flag ───────────────────────────────────────────────────────
// Set window.__CHESS_HELPER_DEBUG = true in DevTools to enable logging.
function isDebug(): boolean {
  return typeof window !== "undefined" &&
    !!(window as Window & { __CHESS_HELPER_DEBUG?: boolean }).__CHESS_HELPER_DEBUG
}

function dbg(...args: unknown[]): void {
  if (isDebug()) console.log("[ChessHelper:GameTracker]", ...args)
}

// ─── Types ────────────────────────────────────────────────────────────

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
}

// ─── Move-list container selectors ───────────────────────────────────

/**
 * Ordered by specificity. We stop at the first one that returns an element.
 */
const MOVE_LIST_SELECTORS = [
  "wc-simple-move-list",        // SPA component (2024+), analysis & standard games
  "vertical-move-list",         // Classic game page
  ".move-list-wrapper",         // Older wrapper
  "chess-moves-simple",         // Embedded boards, studies
  "[data-cy='move-list']",
  ".moves-wrapper",
  "rml",                        // Rapid move list
] as const

// ─── Move-node selectors (tried in order within the container) ────────

/**
 * Each entry is a CSS selector for individual half-move (ply) nodes.
 *
 * Chess.com DOM as of 2025-07:
 *   /analysis        → wc-simple-move-list > div > .node > span.node-highlight-content
 *   /play/computer   → vertical-move-list > .move-list-row .node
 *   /game/archive    → wc-simple-move-list (same as /analysis)
 *   /puzzles         → no move list → returns null (geometric used)
 *
 * The selectors below cover all known variants. We pick the first selector
 * that yields ≥ 1 non-empty text nodes.
 */
const MOVE_NODE_SELECTORS = [
  // Analysis / standard 2024+: text is inside span inside .node
  "span.node-highlight-content",
  // 2024 fallback: entire .node element
  ".node",
  // Classic vertical-move-list variant
  ".move-list-row .node",
  // Even older variants
  "[data-movelistsquare]",
  ".main-line-ply",
  ".move-san",
  // Generic: any element whose class contains "move" and has short text
  // (last resort — checked via text heuristic below)
] as const

// ─── SAN normalisation ────────────────────────────────────────────────

/**
 * Strip annotation symbols and non-SAN characters, keeping the bare move.
 * Valid SAN characters: letters, digits, +, #, =, -
 */
function normaliseSan(raw: string): string {
  return raw
    .replace(/[!?]/g, "")           // !, ?, !?, ?!, !!, ??
    .replace(/\$\d+/g, "")          // PGN NAG codes ($1, $2 …)
    .replace(/[^\w=+#\-]/g, "")     // keep SAN-valid chars only
    .trim()
}

/** Returns true if `s` looks like a valid SAN token (2–7 non-digit-only chars). */
function looksLikeSan(s: string): boolean {
  if (s.length < 2 || s.length > 7) return false
  if (/^\d+\.?$/.test(s)) return false    // move numbers
  if (/^\d+$/.test(s)) return false       // pure numbers
  return true
}

// ─── DOM helpers ──────────────────────────────────────────────────────

function findMoveListElement(): Element | null {
  for (const sel of MOVE_LIST_SELECTORS) {
    const el = document.querySelector(sel)
    if (el) {
      dbg(`[FEN-SOURCE] Move list found via selector: "${sel}"`)
      return el
    }
  }
  dbg("[FEN-SOURCE] No move list element found")
  return null
}

/**
 * Extract ordered SAN strings from the move-list container.
 *
 * Returns [] when:
 *   - The game hasn't started yet (starting position)
 *   - No recognised node structure found (→ caller falls back to geometric)
 */
function extractSanMoves(container: Element): string[] {
  // Strategy A: structured node selectors
  for (const sel of MOVE_NODE_SELECTORS) {
    const nodes = Array.from(container.querySelectorAll(sel))
    if (nodes.length === 0) continue

    const sans: string[] = []
    for (const node of nodes) {
      // Only use the direct text content of this node (not nested children)
      // to avoid duplicating move text from parent + child selectors.
      const text = (node.childNodes[0]?.nodeType === Node.TEXT_NODE
        ? node.childNodes[0].textContent
        : node.textContent
      )?.trim() ?? ""

      if (!text) continue
      const san = normaliseSan(text)
      if (looksLikeSan(san)) sans.push(san)
    }

    if (sans.length > 0) {
      dbg(`[FEN-SOURCE] Extracted ${sans.length} moves via selector "${sel}"`)
      return sans
    }
  }

  // Strategy B: parse raw text content of the whole container
  const raw = container.textContent ?? ""
  const tokens = raw
    .split(/\s+/)
    .map(normaliseSan)
    .filter(looksLikeSan)

  if (tokens.length > 0) {
    dbg(`[FEN-SOURCE] Extracted ${tokens.length} moves via raw text fallback`)
  }
  return tokens
}

// ─── GameTracker ─────────────────────────────────────────────────────

export class GameTracker {
  private chess: Chess
  private lastMoveCount = -1
  private lastMoveSig   = ""     // last-SAN cache key: prevents stale hits on takeback+new move
  private lastFen       = ""
  private readonly options: GameTrackerOptions

  constructor(options: GameTrackerOptions = {}) {
    this.chess   = new Chess()
    this.options = options
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Synchronise with the DOM move list.
   *
   * Returns TrackerState on success.
   * Returns null ONLY when no move list element exists (caller uses geometric).
   *
   * If the move list is empty (starting position), returns a valid
   * starting-position FEN directly — caller does NOT need geometric fallback.
   */
  sync(): TrackerState | null {
    const container = findMoveListElement()

    // No move-list element at all (e.g. /puzzles) → caller uses geometric
    if (!container) {
      this.warn("No move list element — caller should use geometric fallback")
      return null
    }

    const sans = extractSanMoves(container)
    dbg(`[FEN-SOURCE] movelist — ${sans.length} moves read | turn will come from chess.js`)

    // ── Starting position (0 moves played) ──
    if (sans.length === 0) {
      // Game hasn't started yet — return starting position, White's turn
      const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      dbg("[FEN-SOURCE] Empty move list → starting position, turn=w")
      return { fen: startFen, turn: "w", plyCount: 0, source: "chess.js" }
    }

    // ── Cache check (move count + last SAN must both match) ──
    const moveSig = `${sans.length}:${sans[sans.length - 1]}`
    if (moveSig === this.lastMoveSig && this.lastFen) {
      dbg(`[FEN-SOURCE] Cache hit (sig="${moveSig}") → turn=${this.chess.turn()}`)
      return {
        fen:      this.lastFen,
        turn:     this.chess.turn(),
        plyCount: sans.length,
        source:   "chess.js",
      }
    }

    // ── Full replay ──
    const ok = this.replayMoves(sans)
    if (!ok) {
      // Replay failed — return null so caller can fall back
      return null
    }

    this.lastMoveCount = sans.length
    this.lastMoveSig   = moveSig
    this.lastFen       = this.chess.fen()

    dbg(`[FEN-SOURCE] Replayed ${sans.length} moves → turn=${this.chess.turn()} FEN="${this.lastFen}"`)

    return {
      fen:      this.lastFen,
      turn:     this.chess.turn(),
      plyCount: sans.length,
      source:   "chess.js",
    }
  }

  /**
   * Validate piece layout of chess.js FEN against a geometric FEN.
   * Only compares board layout (segment 0), ignoring active color and counters.
   */
  validateAgainstGeometric(geometricFen: string): boolean {
    if (!this.lastFen || !geometricFen) return true
    const cjBoard  = this.lastFen.split(" ")[0]
    const geoBoard = geometricFen.split(" ")[0]
    if (cjBoard !== geoBoard) {
      this.warn(`Board mismatch: chess.js="${cjBoard}" | geometric="${geoBoard}"`)
      return false
    }
    return true
  }

  reset(): void {
    this.chess         = new Chess()
    this.lastMoveCount = -1
    this.lastMoveSig   = ""
    this.lastFen       = ""
    dbg("GameTracker reset")
  }

  getLastFen(): string { return this.lastFen }
  getLastTurn(): "w" | "b" { return this.chess.turn() }

  // ── Private ─────────────────────────────────────────────────────────

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
