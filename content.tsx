import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState, useCallback } from "react"
import { Chessboard } from "react-chessboard"
import type { Square } from "chess.js"
import { GameTracker, findMoveListElement } from "~lib/gameTracker"
import type { TrackerState } from "~lib/gameTracker"

export const config: PlasmoCSConfig = {
  matches: ["https://*.chess.com/*"],
  all_frames: false,
  run_at: "document_idle",
}

console.info("[ChessHelper] build fa9e0e0+ (Diagnostic Session)")

// ─── Types ────────────────────────────────────────────────────────────

interface AnalyzeMessage {
  type: "ANALYZE"
  fen: string
  id: number
  depth?: number
  movetime?: number
}

interface InitMessage {
  type: "INIT_ENGINE"
}

interface StopMessage {
  type: "STOP"
}

type OutgoingMessage = AnalyzeMessage | InitMessage | StopMessage

interface EngineOutputMessage {
  type: "ENGINE_OUTPUT"
  data: string
  id: number
}

// ─── Constants ────────────────────────────────────────────────────────

const PIECE_MAP: Record<string, string> = {
  wp: "P", wn: "N", wb: "B", wr: "R", wq: "Q", wk: "K",
  bp: "p", bn: "n", bb: "b", br: "r", bq: "q", bk: "k",
}

const CHESS_COM_SELECTORS = {
  BOARD:       "chess-board",
  PIECE:       ".piece",
  CLOCK_WHITE: ".clock-white.clock-player-turn",
  CLOCK_BLACK: ".clock-black.clock-player-turn",
} as const

/** Enable via: window.__CHESS_HELPER_DEBUG = true in DevTools */
function isDebug(): boolean {
  return !!(window as Window & { __CHESS_HELPER_DEBUG?: boolean }).__CHESS_HELPER_DEBUG
}
function dbg(...args: unknown[]): void {
  if (isDebug()) console.log("[ChessHelper:content]", ...args)
}

/**
 * Encodes the board array as a compact string for diffing between frames.
 * Used by the geometric fallback to detect which side just moved.
 */
function encodeBoardSig(arr: (string | null)[][]): string {
  return arr.map(row => row.map(c => c ?? ".").join("")).join("|")
}

// ─── Game Context Detection ───────────────────────────────────────────

type GameContext = "live" | "computer" | "puzzle" | "analysis" | "home" | "unknown"

function getGameContext(): GameContext {
  const path = window.location.pathname
  if (path.startsWith("/play/online") || path.startsWith("/game/live"))   return "live"
  if (path.startsWith("/play/computer"))                                   return "computer"
  if (path.startsWith("/puzzles"))                                         return "puzzle"
  if (path.startsWith("/analysis") || path.startsWith("/game/archive"))   return "analysis"
  if (path === "/" || path.startsWith("/home"))                            return "home"
  return "unknown"
}

function isAnalysisAllowed(context: GameContext): boolean {
  // Allow on: computer games, puzzles, analysis, post-game, unknown pages
  // Block on: live games (Chess.com Fair Play policy) and home
  return context !== "live" && context !== "home"
}

// ─── DOM Helpers ──────────────────────────────────────────────────────

function getBoardAndPieces(): { board: Element; pieces: NodeListOf<Element> } | null {
  const chessBoard = document.querySelector(CHESS_COM_SELECTORS.BOARD)
  if (chessBoard) {
    // Try Shadow DOM first (Chess.com v3+)
    if (chessBoard.shadowRoot) {
      const pieces = chessBoard.shadowRoot.querySelectorAll(CHESS_COM_SELECTORS.PIECE)
      if (pieces.length > 0) return { board: chessBoard, pieces }
    }
    // Fallback: light DOM pieces
    const pieces = chessBoard.querySelectorAll(CHESS_COM_SELECTORS.PIECE)
    if (pieces.length > 0) return { board: chessBoard, pieces }
  }

  // Broader search for pieces anywhere in the page
  const docPieces = document.querySelectorAll(CHESS_COM_SELECTORS.PIECE)
  if (docPieces.length > 0) {
    const board =
      docPieces[0].closest("chess-board, .board, [id*='board']") ?? document.body
    return { board, pieces: docPieces }
  }

  return null
}

function checkIsFlipped(boardEl: Element | null): boolean {
  if (!boardEl) return false
  if (boardEl.classList.contains("flipped")) return true
  const cgWrap = boardEl.closest(".cg-wrap") ?? boardEl
  if (cgWrap.classList.contains("orientation-black")) return true
  return false
}

// ─── Geometric FEN Extraction (fallback) ─────────────────────────────

/**
 * Extract the 8x8 board array from DOM geometry.
 * Does NOT determine active color — that is handled by the caller.
 */
function extractBoardArray(): {
  boardArr: (string | null)[][]
  boardEl:  HTMLElement
  isFlipped: boolean
} | null {
  const data = getBoardAndPieces()
  if (!data) return null
  const { board, pieces } = data

  const boardEl    = board as HTMLElement
  const squareSize = (boardEl.offsetWidth || boardEl.getBoundingClientRect().width) / 8
  const boardArr: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null))
  const isFlipped  = checkIsFlipped(boardEl)
  const boardRect  = boardEl.getBoundingClientRect()

  for (const el of Array.from(pieces)) {
    const classes = Array.from(el.classList)
    let pieceChar: string | null = null
    for (const cls of classes) {
      if (cls.length === 2 && PIECE_MAP[cls]) { pieceChar = PIECE_MAP[cls]; break }
    }
    if (!pieceChar) continue

    const pieceRect = el.getBoundingClientRect()
    const cx = pieceRect.left + pieceRect.width  / 2 - boardRect.left
    const cy = pieceRect.top  + pieceRect.height / 2 - boardRect.top
    const col = Math.floor(cx / squareSize)
    const row = Math.floor(cy / squareSize)
    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
      boardArr[isFlipped ? 7 - row : row][isFlipped ? 7 - col : col] = pieceChar
    }
  }

  return { boardArr, boardEl, isFlipped }
}

function detectByClock(): "w" | "b" | null {
  if (document.querySelector(CHESS_COM_SELECTORS.CLOCK_BLACK)) return "b"
  if (document.querySelector(CHESS_COM_SELECTORS.CLOCK_WHITE)) return "w"
  return null
}

function detectByDiff(boardArr: (string | null)[][], prevSig: string, prevTurn: "w" | "b" | "unknown"): "w" | "b" | null {
  if (!prevSig || prevTurn === "unknown") return null
  const currentSig = encodeBoardSig(boardArr)
  return currentSig !== prevSig ? (prevTurn === "w" ? "b" : "w") : prevTurn
}

function detectByPuzzleText(): "w" | "b" | null {
  const puzzleElements = document.querySelectorAll('.message-component, .puzzle-message-component, h3, .status-title, .title-text, [data-cy="turn-indicator"]')
  for (const el of Array.from(puzzleElements)) {
    const text = el.textContent?.toLowerCase() || ""
    if (text.includes("white to move") || text.includes("move for white") || text.includes("white's turn")) return "w"
    if (text.includes("black to move") || text.includes("move for black") || text.includes("black's turn")) return "b"
  }
  return null
}

function detectByOrientation(isFlipped: boolean): "w" | "b" | null {
  const context = getGameContext()
  if (context === "puzzle" || context === "analysis") return isFlipped ? "b" : "w"
  return null
}

function detectByPieceCount(boardArr: (string | null)[][]): "w" | "b" | "unknown" {
  let whiteCount = 0, blackCount = 0
  boardArr.forEach(row => row.forEach(p => {
    if (!p) return
    if (p === p.toUpperCase()) whiteCount++
    else blackCount++
  }))
  if (whiteCount === blackCount) return "unknown"
  return whiteCount < blackCount ? "w" : "b"
}

/**
 * Detect active color for the geometric fallback path.
 */
export function detectActiveColorGeometric(
  boardArr:  (string | null)[][],
  prevSig:   string,
  prevTurn:  "w" | "b" | "unknown",
  isFlipped: boolean
): { turn: "w" | "b" | "unknown", reliable: boolean } {
  const ts = new Date().toISOString()
  const currentSig = encodeBoardSig(boardArr)
  dbg(`[Active Color] [${ts}] Starting detection. prevTurn=${prevTurn}, prevSig=${prevSig.substring(0, 15)}... currentSig=${currentSig.substring(0, 15)}...`)

  let result = detectByClock()
  if (result) { dbg(`[Active Color] [${ts}] Strategy 1 (clock) → ${result}`); return { turn: result, reliable: true } }

  result = detectByDiff(boardArr, prevSig, prevTurn)
  if (result) { dbg(`[Active Color] [${ts}] Strategy 2 (diff) → ${result}`); return { turn: result, reliable: true } }

  result = detectByPuzzleText()
  if (result) { dbg(`[Active Color] [${ts}] Strategy 3 (puzzle text) → ${result}`); return { turn: result, reliable: true } }

  result = detectByOrientation(isFlipped)
  if (result) { dbg(`[Active Color] [${ts}] Strategy 4 (orientation) → ${result}`); return { turn: result, reliable: true } }

  const fallbackResult = detectByPieceCount(boardArr)
  dbg(`[Active Color] [${ts}] Strategy 5 (piece count - unreliable) → ${fallbackResult}`)
  return { turn: fallbackResult, reliable: false }
}

function boardToFenRows(board: (string | null)[][], activeColor: "w" | "b"): string | null {
  const rows: string[] = []
  let hasPieces = false
  for (const row of board) {
    let fenRow = ""
    let empty  = 0
    for (const cell of row) {
      if (cell === null) { empty++ }
      else { hasPieces = true; if (empty > 0) { fenRow += empty; empty = 0 } fenRow += cell }
    }
    if (empty > 0) fenRow += empty
    rows.push(fenRow)
  }
  if (!hasPieces) return null
  return `${rows.join("/")} ${activeColor} - - 0 1`
}

// ─── Overlay Component ────────────────────────────────────────────────

const ChessAssistantOverlay = () => {
  // ── State ──
  const [bestMove,   setBestMove]   = useState("")
  const [evaluation, setEvaluation] = useState("")
  const [depth,      setDepth]      = useState(0)
  const [thinking,   setThinking]   = useState(false)
  const [currentFen, setCurrentFen] = useState("start")
  const [isActive,   setIsActive]   = useState(false)
  const [standby,    setStandby]    = useState(false)
  const [isForced,   setIsForced]   = useState(false)
  const [isFlipped,  setIsFlipped]  = useState(false)
  const [fenSource,  setFenSource]  = useState<"chess.js" | "geometric-fallback" | "">("")
  const [speedMode,  setSpeedMode]  = useState<"fast" | "normal" | "deep">("fast")
  const [complianceBlocked, setComplianceBlocked] = useState(false)

  // ── Refs ──
  const lastFenRef      = useRef("")
  const observerRef     = useRef<MutationObserver | null>(null)
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const analysisIdRef   = useRef(0)
  const gameTrackerRef  = useRef(new GameTracker({
    onWarning: (msg) => console.warn("[ChessHelper:GameTracker]", msg),
  }))
  // Geometric fallback state — used by diff-based active color detection
  const prevBoardSigRef = useRef("")    // encoded board from last geometric extraction
  const prevGeoTurnRef  = useRef<"w" | "b" | "unknown">("unknown")  // turn from last geometric extraction
  const traceMetaRef    = useRef({ src: "", plies: 0, lastSan: "", turnSrc: "" })

  // ── Reset analysis display ──
  const resetAnalysis = () => {
    setBestMove("")
    setEvaluation("")
    setDepth(0)
    setThinking(true)
  }

  const processGeometricData = useCallback((geoData: { boardArr: (string | null)[][], boardEl: HTMLElement, isFlipped: boolean }) => {
    const { turn, reliable } = detectActiveColorGeometric(
      geoData.boardArr, prevBoardSigRef.current, prevGeoTurnRef.current, geoData.isFlipped
    )
    
    prevBoardSigRef.current = encodeBoardSig(geoData.boardArr)
    
    if (reliable && turn !== "unknown") {
      prevGeoTurnRef.current = turn
    } else {
      console.warn(`[ChessHelper] Unreliable turn detection (${turn}). Not updating prevGeoTurnRef.`)
    }
    
    if (turn === "unknown") {
      console.warn("[ChessHelper] Turn is unknown and no reliable proof exists. Skipping analysis.")
      return null
    }

    traceMetaRef.current.turnSrc = reliable ? "geometric-strategies" : "piece-count"
    traceMetaRef.current.plies = gameTrackerRef.current['lastMoveCount'] ?? 0
    traceMetaRef.current.lastSan = "N/A"
    return boardToFenRows(geoData.boardArr, turn as "w" | "b")
  }, [])

  const handleDesync = useCallback((geoData: { boardArr: (string | null)[][], boardEl: HTMLElement, isFlipped: boolean }) => {
    gameTrackerRef.current.reset()
    console.warn("[ChessHelper] Board desync — resetting GameTracker")
    setFenSource("geometric-fallback")
    return processGeometricData(geoData)
  }, [processGeometricData])

  const getGeometricFallbackFen = useCallback((): string | null => {
    const geoData = extractBoardArray()
    if (!geoData) return null
    const fen = processGeometricData(geoData)
    if (fen) {
      dbg(`[FEN-SOURCE] geometric → turn=${prevGeoTurnRef.current} fen="${fen}"`)
      setFenSource("geometric-fallback")
    }
    return fen
  }, [processGeometricData])

  // ── Primary FEN resolution: GameTracker (chess.js) → geometric fallback ──
  const resolveFen = useCallback((): string | null => {
    const tracker = gameTrackerRef.current
    const state = tracker.sync()
    if (state) {
      const geoData = extractBoardArray()
      if (geoData) {
        const geoBoard = boardToFenRows(geoData.boardArr, state.turn)
        if (geoBoard && !tracker.validateAgainstGeometric(geoBoard)) {
          return handleDesync(geoData)
        }
      }
      dbg(`[FEN-SOURCE] chess.js → turn=${state.turn} fen="${state.fen}"`)
      setFenSource("chess.js")
      prevBoardSigRef.current = ""
      
      traceMetaRef.current = {
        src: "movelist",
        plies: state.plyCount,
        lastSan: gameTrackerRef.current['lastMoveSig']?.split(':')[1] || "none",
        turnSrc: "chess.js"
      }
      return state.fen
    }
    
    const fallbackFen = getGeometricFallbackFen()
    if (fallbackFen) traceMetaRef.current.src = "geometric"
    return fallbackFen
  }, [getGeometricFallbackFen, handleDesync])

  // ── Trigger analysis ──
  const triggerAnalysis = useCallback((force = false) => {
    if (!isActive) return
    if (force) setIsForced(true)

    // Compliance check — block live games
    const context = getGameContext()
    if (!isAnalysisAllowed(context) && !force && !isForced) {
      setComplianceBlocked(true)
      setStandby(true)
      setThinking(false)
      setBestMove("")
      return
    }
    setComplianceBlocked(false)

    // Check game is active (move list exists or forced)
    const hasGame = force || isForced || findMoveListElement() !== null
    if (!hasGame) {
      setStandby(true)
      setThinking(false)
      setBestMove("")
      return
    }
    setStandby(false)

    const fen = resolveFen()
    if (!fen) return

    if (fen === lastFenRef.current) return  // Position unchanged
    lastFenRef.current = fen
    setCurrentFen(fen)
    resetAnalysis()

    // ── Task 2: increment ID, ignore stale responses ──
    const id = ++analysisIdRef.current

    const msg: AnalyzeMessage = { type: "ANALYZE", fen, id }
    if (speedMode === "fast")   msg.movetime = 500
    else if (speedMode === "normal") msg.depth = 15
    else if (speedMode === "deep")   msg.depth = 20

    if (isDebug()) {
      const ts = new Date().toISOString()
      const { src, plies, lastSan, turnSrc } = traceMetaRef.current
      const turn = fen.split(" ")[1]
      const fenHead = fen.split(" ")[0] + " " + turn
      console.log(`[TRACE] t=${ts} src=${src} plies=${plies} lastSan=${lastSan} turn=${turn} turnSrc=${turnSrc} fen=${fenHead} id=${id}`)
    }

    chrome.runtime.sendMessage(msg as OutgoingMessage)
  }, [isActive, isForced, speedMode, resolveFen])

  // Retrigger when speedMode changes while active
  useEffect(() => {
    if (isActive && lastFenRef.current) {
      lastFenRef.current = ""
      triggerAnalysis(true)
    }
  }, [speedMode, isActive, triggerAnalysis])

  // ── MutationObserver attachment ──
  const attachObserver = useCallback(() => {
    if (observerRef.current) return

    const data = getBoardAndPieces()
    if (!data) return

    const { board } = data
    setIsFlipped(checkIsFlipped(board))

    const observer = new MutationObserver(() => {
      setIsFlipped(checkIsFlipped(board))
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => triggerAnalysis(false), 150)
    })

    // Watch board element (prefer shadowRoot to avoid double-firing)
    const target = board.shadowRoot ?? board
    observer.observe(target, {
      childList:  true,
      subtree:    true,
      attributes: true,
      attributeFilter: ["class", "style"],
    })

    observerRef.current = observer
    triggerAnalysis(false)
  }, [triggerAnalysis])

  // ── Engine control ──
  const startAnalysis = useCallback(() => {
    chrome.runtime.sendMessage({ type: "INIT_ENGINE" } satisfies InitMessage)
    setIsActive(true)
  }, [])

  const stopAnalysis = useCallback(() => {
    chrome.runtime.sendMessage({ type: "STOP" } satisfies StopMessage)
    setIsActive(false)
    setIsForced(false)
    setThinking(false)
    setBestMove("")
    setEvaluation("")
    setDepth(0)
  }, [])

  // ── ENGINE_OUTPUT listener (Task 2: filter stale IDs) ──
  useEffect(() => {
    const onMessage = (msg: EngineOutputMessage) => {
      if (msg.type !== "ENGINE_OUTPUT") return

      // ← Task 2: discard results from previous analysis requests
      if (typeof msg.id === "number" && msg.id < analysisIdRef.current) return

      const line: string = msg.data

      if (line.startsWith("info") && line.includes(" pv ")) {
        const depthM = line.match(/\bdepth\s+(\d+)/)
        const scoreM = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)

        if (depthM) setDepth(parseInt(depthM[1], 10))

        if (scoreM) {
          const [, type, raw] = scoreM
          const val = parseInt(raw, 10)
          if (type === "cp") {
            const s = (val / 100).toFixed(2)
            setEvaluation(val >= 0 ? `+${s}` : s)
          } else {
            setEvaluation(`M${Math.abs(val)}`)
          }
        }
      }

      if (line.startsWith("bestmove")) {
        const parts = line.split(/\s+/)
        if (parts[1] && parts[1] !== "(none)") {
          setBestMove(parts[1])
          setThinking(false)
        } else {
          setBestMove("")
          setThinking(false)
        }
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  // ── Observer lifecycle (attach/detach with isActive) ──
  useEffect(() => {
    if (!isActive) {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (retryRef.current) clearInterval(retryRef.current)
      retryRef.current = null
      return
    }

    attachObserver()
    if (!observerRef.current) {
      retryRef.current = setInterval(() => {
        attachObserver()
        if (observerRef.current) {
          clearInterval(retryRef.current!)
          retryRef.current = null
        }
      }, 500)
    }

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (retryRef.current) clearInterval(retryRef.current)
      retryRef.current = null
    }
  }, [isActive, attachObserver])

  // ── Task 3: SPA Navigation Handling ──
  useEffect(() => {
    let lastPathname = window.location.pathname

    const handleNavigation = () => {
      const currentPathname = window.location.pathname
      if (currentPathname === lastPathname) return
      lastPathname = currentPathname

      console.log("[ChessHelper:content] SPA navigation detected:", currentPathname)

      // Disconnect old observer
      observerRef.current?.disconnect()
      observerRef.current = null

      // Reset state
      lastFenRef.current      = ""
      analysisIdRef.current++          // Invalidate any in-flight analysis
      gameTrackerRef.current.reset()
      prevBoardSigRef.current = ""     // Clear diff state for geometric fallback
      prevGeoTurnRef.current  = "w"
      setBestMove("")
      setEvaluation("")
      setDepth(0)
      setThinking(false)
      setFenSource("")

      // Re-attach observer after DOM settles
      if (isActive) {
        setTimeout(() => {
          attachObserver()
        }, 1200)
      }
    }

    // Strategy A: Navigation API (Chrome 102+, no isolated world issues)
    if ("navigation" in window) {
      const nav = (window as Window & { navigation: EventTarget }).navigation
      nav.addEventListener("navigate", handleNavigation)

      return () => {
        nav.removeEventListener("navigate", handleNavigation)
      }
    }

    // Strategy B: Polling fallback (for browsers without Navigation API)
    const pollInterval = setInterval(handleNavigation, 1000)
    return () => clearInterval(pollInterval)

  }, [isActive, attachObserver])

  // ── Auto-start on mount ──
  useEffect(() => {
    const t = setTimeout(startAnalysis, 1500)
    return () => clearTimeout(t)
  }, [startAnalysis])

  // ── Arrow rendering ──
  const getCustomArrows = (): [Square, Square][] => {
    if (!bestMove || bestMove.length < 4) return []
    return [
      [
        bestMove.substring(0, 2) as Square,
        bestMove.substring(2, 4) as Square,
      ]
    ]
  }

  // ── Render ──
  return (
    <div
      id="chess-helper-ai-overlay"
      role="complementary"
      aria-label="Chess Helper AI Analysis Panel"
      style={{
        position:       "fixed",
        top:            12,
        right:          12,
        padding:        "16px 18px",
        background:     "linear-gradient(145deg, rgba(13,17,23,0.96) 0%, rgba(22,27,34,0.96) 100%)",
        color:          "#c9d1d9",
        borderRadius:   "14px",
        zIndex:         2147483647,
        fontFamily:     "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize:       "13px",
        width:          "clamp(240px, 20vw, 300px)",
        boxShadow:      "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,95,0.25)",
        backdropFilter: "blur(16px)",
        pointerEvents:  "auto",
        userSelect:     "none",
        lineHeight:     1.5,
        transition:     "box-shadow 0.3s ease",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "18px" }}>♟</span>
          <span style={{ fontWeight: 700, fontSize: "13px", color: "#38bd5f", letterSpacing: "0.3px" }}>
            Chess Helper AI
          </span>
        </div>
        <button
          onClick={isActive ? stopAnalysis : startAnalysis}
          style={{
            background:   isActive ? "linear-gradient(135deg,#cf222e,#a40e26)" : "linear-gradient(135deg,#238636,#1a7f37)",
            border:       "none",
            color:        "#fff",
            padding:      "4px 11px",
            borderRadius: "6px",
            fontSize:     "11px",
            fontWeight:   600,
            cursor:       "pointer",
            transition:   "opacity 0.2s",
          }}
        >
          {isActive ? "Stop" : "Start"}
        </button>
      </div>

      {/* Speed selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", background: "rgba(255,255,255,0.05)", padding: "6px 8px", borderRadius: "8px" }}>
        <span style={{ fontSize: "11px", color: "#8b949e", fontWeight: 600 }}>Speed:</span>
        <select
          value={speedMode}
          onChange={(e) => setSpeedMode(e.target.value as "fast" | "normal" | "deep")}
          disabled={!isActive}
          style={{
            background:   "transparent",
            color:        "#c9d1d9",
            border:       "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px",
            padding:      "2px 4px",
            fontSize:     "11px",
            outline:      "none",
            cursor:       isActive ? "pointer" : "not-allowed",
          }}
        >
          <option value="fast"   style={{ background: "#161b22" }}>Fast (0.5s)</option>
          <option value="normal" style={{ background: "#161b22" }}>Normal (Depth 15)</option>
          <option value="deep"   style={{ background: "#161b22" }}>Deep (Depth 20)</option>
        </select>
      </div>

      {/* Status indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "12px" }}>
        <span style={{
          width:           8,
          height:          8,
          borderRadius:    "50%",
          backgroundColor: !isActive ? "#484f58" : (complianceBlocked ? "#f85149" : standby ? "#e3b341" : "#38bd5f"),
          boxShadow:       isActive && !standby && !complianceBlocked ? "0 0 8px #38bd5f" : "none",
        }} />
        <span style={{
          color:      !isActive ? "#8b949e" : complianceBlocked ? "#f85149" : standby ? "#e3b341" : "#38bd5f",
          fontSize:   "12px",
          fontWeight: standby || complianceBlocked ? 600 : 400,
        }}>
          {!isActive          ? "Paused"
           : complianceBlocked ? "⚠ Disabled in Live Games"
           : standby           ? "Standby: No Game"
           : thinking          ? "Thinking…"
           :                    "Ready"}
        </span>
        {depth > 0 && !standby && (
          <span style={{ color: "#484f58", fontSize: "11px", marginLeft: "auto" }}>
            d{depth}
            {fenSource === "chess.js" && (
              <span style={{ color: "#238636", marginLeft: "4px" }}>✓</span>
            )}
          </span>
        )}
      </div>

      {/* Board + results */}
      {standby && isActive && !complianceBlocked ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ color: "#d29922", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
            Standby: No Game
          </div>
          <button
            onClick={() => triggerAnalysis(true)}
            style={{ width: "100%", background: "rgba(210,153,34,0.1)", border: "1px solid rgba(210,153,34,0.3)", color: "#d29922", padding: "6px 0", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
          >
            Force Start
          </button>
        </div>
      ) : !standby && isActive && !complianceBlocked && (
        <div style={{ marginTop: "12px", marginBottom: "12px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          <Chessboard
            position={currentFen}
            boardOrientation={isFlipped ? "black" : "white"}
            customArrows={getCustomArrows() as any}
            customArrowColor="rgba(56, 189, 95, 0.8)"
            arePiecesDraggable={false}
          />
        </div>
      )}

      {/* Best move display */}
      {bestMove && !standby && !complianceBlocked ? (
        <div aria-live="polite" style={{ background: "rgba(35,134,54,0.12)", border: "1px solid rgba(56,189,95,0.25)", borderRadius: "10px", padding: "10px 14px", textAlign: "center" }}>
          <div style={{ color: "#8b949e", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "4px" }}>Best Move</div>
          <div style={{ color: "#ffd60a", fontSize: "22px", fontWeight: 800, fontFamily: "'SF Mono', 'Cascadia Code', monospace", letterSpacing: "2px" }}>{bestMove}</div>
          {evaluation && (
            <div style={{ marginTop: "4px", fontSize: "12px", fontWeight: 600, color: evaluation.startsWith("-") ? "#f85149" : "#3fb950" }}>
              {evaluation}
            </div>
          )}
        </div>
      ) : isActive && thinking && !standby && !complianceBlocked ? (
        <div style={{ textAlign: "center", color: "#484f58", fontSize: "12px", padding: "10px 0" }}>
          <span style={{ animation: "pulse 1.4s ease-in-out infinite" }}>Calculating…</span>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        </div>
      ) : null}
    </div>
  )
}

export default ChessAssistantOverlay
