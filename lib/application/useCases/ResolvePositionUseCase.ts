import type { IBoardReader } from "../../domain/ports/IBoardReader"
import type { IMoveListReader } from "../../domain/ports/IMoveListReader"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import { DetectActiveColorUseCase } from "./DetectActiveColorUseCase"
import { ChessPosition } from "../../domain/entities/ChessPosition"
import type { GameTracker } from "../../tracker/gameTracker"
import type { PuzzleState } from "../../board/activeColorDetector"
import { resolvePuzzleTurn } from "../../board/activeColorDetector"
import { boardToFenRows, getHeuristicCastling } from "../../domain/services/FenBuilder"
import { encodeBoardSig } from "../../domain/services/BoardEncoder"
import type { ActiveColor } from "../../domain/types"
import { dbg } from "../../core/debug"

export interface ResolvePositionResult {
  position: ChessPosition | null
  newBoardSig: string
  newGeoTurn: ActiveColor | "unknown"
  traceMeta: {
    src: string
    plies: number
    lastSan: string
    turnSrc: string
  }
}

export class ResolvePositionUseCase {
  constructor(
    private readonly boardReader: IBoardReader,
    private readonly moveListReader: IMoveListReader,
    private readonly contextProvider: IGameContextProvider,
    private readonly colorDetector: DetectActiveColorUseCase,
  ) {}

  execute(
    gameTracker: GameTracker,
    puzzleState: PuzzleState,
    prevBoardSig: string,
    prevGeoTurn: ActiveColor | "unknown",
  ): ResolvePositionResult {
    const context = this.contextProvider.getContext()

    // ── 1. Puzzle Path ──
    if (context === "puzzle") {
      return this.resolvePuzzle(gameTracker, puzzleState)
    }

    // ── 2. Normal Path: MoveList / chess.js ──
    const trackerState = gameTracker.sync()
    if (trackerState) {
      const geoReading = this.boardReader.read()
      if (geoReading) {
        const geoBoard = boardToFenRows(geoReading.boardArr, trackerState.turn)
        if (geoBoard && !gameTracker.validateAgainstGeometric(geoBoard)) {
          // Desync detected
          gameTracker.reset()
          console.warn("[ChessHelper] Board desync — resetting GameTracker")
          return this.resolveGeometric(geoReading, prevBoardSig, prevGeoTurn)
        }
      }

      dbg("content", `[FEN-SOURCE] chess.js → turn=${trackerState.turn} fen="${trackerState.fen}"`)
      return {
        position: ChessPosition.fromFen(trackerState.fen, "chess.js", trackerState.plyCount),
        newBoardSig: "",
        newGeoTurn: prevGeoTurn,
        traceMeta: {
          src: "movelist",
          plies: trackerState.plyCount,
          lastSan: "none",
          turnSrc: "chess.js",
        },
      }
    }

    // ── 3. Geometric Fallback Path ──
    const geoReading = this.boardReader.read()
    if (!geoReading) {
      return {
        position: null,
        newBoardSig: prevBoardSig,
        newGeoTurn: prevGeoTurn,
        traceMeta: { src: "none", plies: 0, lastSan: "", turnSrc: "none" },
      }
    }

    const res = this.resolveGeometric(geoReading, prevBoardSig, prevGeoTurn)
    res.traceMeta.src = "geometric"
    return res
  }

  private resolvePuzzle(gameTracker: GameTracker, puzzleState: PuzzleState): ResolvePositionResult {
    const geoReading = this.boardReader.read()
    if (!geoReading) {
      return {
        position: null,
        newBoardSig: "",
        newGeoTurn: "unknown",
        traceMeta: { src: "none", plies: 0, lastSan: "", turnSrc: "none" },
      }
    }

    const castling = getHeuristicCastling(geoReading.boardArr)
    const container = this.moveListReader.findContainer()
    const currentPlies = gameTracker.extractPliesCountOnly()

    const detectText = () => {
      const turnRes = this.colorDetector.execute({
        boardArr: geoReading.boardArr,
        prevBoardSig: "",
        prevTurn: "unknown",
        isFlipped: geoReading.isFlipped,
      })
      return turnRes.reliable && turnRes.turn !== "unknown" ? turnRes.turn : null
    }

    const detectOrientation = (flipped: boolean) => (flipped ? ("b" as const) : ("w" as const))

    const { turn, turnSrc } = resolvePuzzleTurn(
      container !== null,
      geoReading.isFlipped,
      currentPlies,
      puzzleState,
      detectText,
      detectOrientation,
    )

    if (turn === "unknown") {
      console.warn("[ChessHelper] Puzzle turn unknown. Standby.")
      return {
        position: null,
        newBoardSig: "",
        newGeoTurn: "unknown",
        traceMeta: { src: "geometric-puzzle", plies: currentPlies, lastSan: "N/A", turnSrc },
      }
    }

    const fen = boardToFenRows(geoReading.boardArr, turn as ActiveColor, castling)
    return {
      position: fen ? ChessPosition.fromFen(fen, "geometric-puzzle", currentPlies) : null,
      newBoardSig: encodeBoardSig(geoReading.boardArr),
      newGeoTurn: turn,
      traceMeta: { src: "geometric-puzzle", plies: currentPlies, lastSan: "N/A", turnSrc },
    }
  }

  private resolveGeometric(
    geoReading: { boardArr: (string | null)[][]; isFlipped: boolean },
    prevBoardSig: string,
    prevGeoTurn: ActiveColor | "unknown",
  ): ResolvePositionResult {
    const turnResult = this.colorDetector.execute({
      boardArr: geoReading.boardArr,
      prevBoardSig,
      prevTurn: prevGeoTurn,
      isFlipped: geoReading.isFlipped,
    })

    const newBoardSig = encodeBoardSig(geoReading.boardArr)
    let newGeoTurn = prevGeoTurn

    if (turnResult.reliable && turnResult.turn !== "unknown") {
      newGeoTurn = turnResult.turn
    } else {
      console.warn(
        `[ChessHelper] Unreliable turn detection (${turnResult.turn}). Not updating prevGeoTurnRef.`,
      )
    }

    if (turnResult.turn === "unknown") {
      console.warn("[ChessHelper] Turn is unknown and no reliable proof exists. Skipping analysis.")
      return {
        position: null,
        newBoardSig,
        newGeoTurn,
        traceMeta: { src: "geometric", plies: 0, lastSan: "N/A", turnSrc: "none" },
      }
    }

    const castling = getHeuristicCastling(geoReading.boardArr)
    const fen = boardToFenRows(geoReading.boardArr, turnResult.turn as ActiveColor, castling)

    return {
      position: fen ? ChessPosition.fromFen(fen, "geometric", 0) : null,
      newBoardSig,
      newGeoTurn,
      traceMeta: {
        src: "geometric",
        plies: 0,
        lastSan: "N/A",
        turnSrc: turnResult.reliable ? "geometric-strategies" : "piece-count",
      },
    }
  }
}
