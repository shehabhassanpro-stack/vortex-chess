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

import { MOVE_LIST_SELECTORS } from "./chessDomSelectors"

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
  if (raw.includes("1-0") || raw.includes("0-1") || raw.includes("1/2")) return ""
  
  let s = raw.trim()
  s = s.replace(/^\d+\.+/, "") // Remove move numbers like "12." or "12..."

  return s
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

export function findMoveListElement(): Element | null {
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
/**
 * Extract text from a move node, accounting for Chess.com's Figurine Notation.
 * Chess.com uses: <span data-figurine="N" class="icon-font-chess knight-white"></span>e7
 */
function extractNodeSan(node: Element): string {
  let san = ""
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      
      const piece = el.getAttribute('data-figurine')
      if (piece) {
        san += piece
      } else {
        const cls = el.className || ""
        if (typeof cls === 'string') {
          if (cls.includes('knight')) san += 'N'
          else if (cls.includes('bishop')) san += 'B'
          else if (cls.includes('rook')) san += 'R'
          else if (cls.includes('queen')) san += 'Q'
          else if (cls.includes('king')) san += 'K'
        }
      }
      // Also grab textContent. NormaliseSan will strip out any font glyphs (like ♘).
      san += el.textContent || ""
    } else if (child.nodeType === Node.TEXT_NODE) {
      san += child.textContent || ""
    }
  }
  return san
}

function extractSanMoves(container: Element): Array<{ san: string, raw: string }> {
  // Strategy A: structured node selectors
  for (const sel of MOVE_NODE_SELECTORS) {
    const nodes = Array.from(container.querySelectorAll(sel))
    if (nodes.length === 0) continue

    const moves: Array<{ san: string, raw: string }> = []
    for (const node of nodes) {
      const text = extractNodeSan(node)

      if (!text) continue
      const san = normaliseSan(text)
      if (looksLikeSan(san)) {
        // Grab outerHTML for element nodes or textContent for text nodes
        const raw = node.nodeType === Node.ELEMENT_NODE ? (node as Element).outerHTML : node.textContent || ""
        moves.push({ san, raw })
      }
    }

    if (moves.length > 0) {
      dbg(`[FEN-SOURCE] Extracted ${moves.length} moves via selector "${sel}"`)
      return moves
    }
  }

  // Strategy B: parse raw text content of the whole container
  const raw = container.textContent ?? ""
  const tokens = raw
    .split(/\s+/)
    .map(t => ({ san: normaliseSan(t), raw: t }))
    .filter(m => looksLikeSan(m.san))

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
  private failedReplayCount = 0
  private lastMissingListWarnTime = 0
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
      const now = Date.now()
      if (now - this.lastMissingListWarnTime > 30000) {
        this.warn("No move list element — caller should use geometric fallback")
        this.lastMissingListWarnTime = now
      }
      return null
    }

    const moves = extractSanMoves(container)
    const sans = moves.map(m => m.san)
    const lastSan = sans.length > 0 ? sans[sans.length - 1] : "none"
    dbg(`[FEN-SOURCE] [${new Date().toISOString()}] movelist — ${sans.length} moves read | last SAN: ${lastSan} | turn will come from chess.js`)

    // ── Starting position (0 moves played) ──
    if (sans.length === 0) {
      // Game hasn't started yet — return starting position, White's turn
      const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      dbg("[FEN-SOURCE] Empty move list → starting position, turn=w")
      return { fen: startFen, turn: "w", plyCount: 0, source: "chess.js" }
    }

    const cachedState = this.checkCache(sans)
    if (cachedState) return cachedState

    return this.performFullReplay(moves)
  }

  private checkCache(sans: string[]): TrackerState | null {
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
    return null
  }

  private performFullReplay(moves: Array<{ san: string, raw: string }>): TrackerState | null {
    const ok = this.replayMoves(moves)
    if (!ok) {
      this.failedReplayCount++
      if (this.failedReplayCount >= 2) {
        console.warn(`[ChessHelper:GameTracker] Persistent replay failure detected. Selector or parsing may be broken. Using geometric fallback.`)
      }
      return null
    }

    this.failedReplayCount = 0
    const sans = moves.map(m => m.san)

    this.lastMoveCount = sans.length
    this.lastMoveSig   = `${sans.length}:${sans[sans.length - 1]}`
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

  private replayMoves(moves: Array<{ san: string, raw: string }>): boolean {
    const fresh = new Chess()

    for (let i = 0; i < moves.length; i++) {
      const { san, raw } = moves[i]
      try {
        const result = fresh.move(san)
        if (result === null) {
          dbg(`[FEN-SOURCE] Failed move="${san}" at ply ${i + 1}. Raw node: ${raw}`)
          return false
        }
      } catch (e) {
        dbg(`[FEN-SOURCE] Exception on move="${san}" at ply ${i + 1}. Raw node: ${raw}`)
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
