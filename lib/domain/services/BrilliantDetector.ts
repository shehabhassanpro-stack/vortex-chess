import { Chess, type Square, type PieceSymbol } from "chess.js"
import type { MultiPVCandidate, BrilliantResult } from "../types"

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 10000,
}

export class BrilliantDetector {
  /**
   * Evaluates candidate moves across ALL MultiPV lines for Brilliant ($!!$) tactical sacrifices.
   *
   * A move is Brilliant if:
   *   1. It sacrifices material (Piece value > Captured value) onto an attacked square.
   *   2. The resulting position retains a decisive winning evaluation (>= +75cp or forced mate).
   *   3. The tactical sequence justifies the investment over quiet moves.
   */
  static detect(candidates: MultiPVCandidate[], fen: string): BrilliantResult {
    if (!candidates || candidates.length === 0 || !fen) {
      return { isBrilliant: false, isPreBrilliant: false, move: "" }
    }

    let preBrilliantResult: BrilliantResult | null = null

    // ── Scan ALL MultiPV candidates to discover brilliant sacrifices ──
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      if (!candidate || !candidate.move || candidate.move.length < 4) continue

      // ── Step 1: Pre-Brilliant Check in PV Sequence (2 plies deep) ──
      if (candidate.pvLine && candidate.pvLine.length >= 2 && !preBrilliantResult) {
        try {
          const chessPV = new Chess(fen)
          const m1From = candidate.pvLine[0].slice(0, 2) as Square
          const m1To = candidate.pvLine[0].slice(2, 4) as Square
          const m1Promo =
            candidate.pvLine[0].length > 4 ? (candidate.pvLine[0][4] as PieceSymbol) : undefined

          const m1 = chessPV.move({ from: m1From, to: m1To, promotion: m1Promo })
          if (m1 && candidate.pvLine[1]) {
            const m2Str = candidate.pvLine[1]
            const m2From = m2Str.slice(0, 2) as Square
            const m2To = m2Str.slice(2, 4) as Square
            const p2 = chessPV.get(m2From)
            const target2 = chessPV.get(m2To)
            if (p2) {
              const p2Val = PIECE_VALUES[p2.type] || 0
              const target2Val = target2 ? PIECE_VALUES[target2.type] || 0 : 0
              if (p2Val >= 300 && p2Val > target2Val && candidate.scoreCp >= 90) {
                preBrilliantResult = {
                  isBrilliant: false,
                  isPreBrilliant: true,
                  move: candidate.move,
                  reason: `Sets up future sacrifice of ${p2.type.toUpperCase()}`,
                }
              }
            }
          }
        } catch {
          // Ignore PV parsing failures
        }
      }

      // ── Step 2: Direct Brilliant Sacrifice Evaluation ──
      try {
        const chess = new Chess(fen)
        const moveStr = candidate.move
        const from = moveStr.slice(0, 2) as Square
        const to = moveStr.slice(2, 4) as Square
        const promo = moveStr.length > 4 ? (moveStr[4] as PieceSymbol) : undefined

        const piece = chess.get(from)
        if (!piece) continue

        const movingPieceVal = PIECE_VALUES[piece.type] || 0
        const capturedPiece = chess.get(to)
        const capturedPieceVal = capturedPiece ? PIECE_VALUES[capturedPiece.type] || 0 : 0

        // Only major or minor pieces (>= 300cp) or passed pawn sacrifices can qualify
        if (movingPieceVal < 300 && capturedPieceVal === 0) {
          continue
        }

        const moveRes = chess.move({ from, to, promotion: promo })
        if (!moveRes) continue

        const opponentTurn = chess.turn()
        const isAttacked = chess.isAttacked(to, opponentTurn)

        // Identify sacrifice category:
        // A. Direct piece sacrifice: Minor/Major piece moving to attacked square for lower-value capture
        // B. Exchange sacrifice: Rook (500) sacrificed for Knight/Bishop (300) on attacked square
        // C. Queen sacrifice: Queen (900) sacrificed for Rook/Minor piece
        const isMinorSacrifice =
          movingPieceVal >= 300 && movingPieceVal > capturedPieceVal && isAttacked
        const isExchangeSacrifice = movingPieceVal === 500 && capturedPieceVal <= 300 && isAttacked
        const isQueenSacrifice = movingPieceVal === 900 && capturedPieceVal <= 500 && isAttacked

        const isSacrifice = isMinorSacrifice || isExchangeSacrifice || isQueenSacrifice
        if (!isSacrifice) continue

        // Evaluation Soundness: Position must be sound/winning (scoreCp >= +75 or mate)
        const isWinningEval = candidate.scoreCp >= 75 || Math.abs(candidate.scoreCp) >= 9000

        if (isWinningEval) {
          const evalFormatted =
            candidate.scoreCp >= 9000 ? "Forced Mate" : `+${(candidate.scoreCp / 100).toFixed(2)}`

          return {
            isBrilliant: true,
            isPreBrilliant: false,
            move: candidate.move,
            sacrificedPiece: piece.type.toUpperCase(),
            reason: `Brilliant sacrifice of ${piece.type.toUpperCase()} with decisive advantage (${evalFormatted})`,
          }
        }
      } catch {
        // Continue scanning remaining candidates
      }
    }

    if (preBrilliantResult) {
      return preBrilliantResult
    }

    return { isBrilliant: false, isPreBrilliant: false, move: candidates[0]?.move || "" }
  }
}
