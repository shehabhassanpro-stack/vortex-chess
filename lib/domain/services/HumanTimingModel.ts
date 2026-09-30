import { Chess } from "chess.js"
import type { TimingRecommendation } from "../types"

export class HumanTimingModel {
  /**
   * Calculates a realistic human move delay window in milliseconds
   * based on the board complexity and game phase.
   */
  static calculateDelay(fen: string, isCapture: boolean = false): TimingRecommendation {
    try {
      const chess = new Chess(fen)
      const board = chess.board()

      let pieceCount = 0
      let majorMinorCount = 0

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c]
          if (piece) {
            pieceCount++
            if (piece.type !== "p" && piece.type !== "k") {
              majorMinorCount++
            }
          }
        }
      }

      // Opening phase (high piece count) or obvious recaptures are fast
      if (isCapture && pieceCount < 16) {
        // Simple recapture in endgame
        return {
          minDelayMs: 1200,
          maxDelayMs: 2500,
          targetDelayMs: 1800,
        }
      }

      if (pieceCount >= 30) {
        // Book opening moves
        return {
          minDelayMs: 1500,
          maxDelayMs: 3200,
          targetDelayMs: 2200,
        }
      }

      // Complex middlegame (many major/minor pieces)
      if (majorMinorCount >= 8) {
        return {
          minDelayMs: 2500,
          maxDelayMs: 6500,
          targetDelayMs: 4000,
        }
      }

      // Endgame
      return {
        minDelayMs: 1800,
        maxDelayMs: 4500,
        targetDelayMs: 2800,
      }
    } catch {
      // Default fallback
      return {
        minDelayMs: 2000,
        maxDelayMs: 4500,
        targetDelayMs: 3000,
      }
    }
  }
}
