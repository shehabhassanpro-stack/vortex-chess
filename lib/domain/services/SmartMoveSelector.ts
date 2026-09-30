import { Chess, type Square, type PieceSymbol } from "chess.js"
import type { MultiPVCandidate } from "../types"
import { Mulberry32 } from "../../engine/weakMoveModel"

export interface SelectMoveOptions {
  tierId?: string
  temperature?: number
  elo?: number
  fen?: string
  rng?: Mulberry32
}

/**
 * Tactical Sanity Guard:
 * Checks if a candidate move hangs material or allows an immediate decisive tactical blow.
 * Behavior is graded by Elo:
 *   - Elo <= 1100: Only guards against immediate checkmate in 1 (allows natural beginner errors).
 *   - Elo 1101..1600: Guards against hanging Queen (900cp) and checkmate.
 *   - Elo > 1600: Guards against hanging any minor or major piece (>= 300cp).
 */
export function isTacticalBlunder(
  fen: string,
  candidateMove: string,
  cpLoss: number,
  elo: number,
): boolean {
  // If the move loses very little centipawns or improves position, it's not a blunder
  if (cpLoss <= 40) return false

  try {
    const chess = new Chess(fen)
    const from = candidateMove.slice(0, 2) as Square
    const to = candidateMove.slice(2, 4) as Square
    const piece = chess.get(from)

    if (!piece) return false

    // Moving piece value: p=100, n=300, b=300, r=500, q=900, k=10000
    const pieceValues: Record<string, number> = {
      p: 100,
      n: 300,
      b: 300,
      r: 500,
      q: 900,
      k: 10000,
    }

    const movingVal = pieceValues[piece.type] || 0
    const targetPiece = chess.get(to)
    const targetVal = targetPiece ? pieceValues[targetPiece.type] || 0 : 0

    // Grade threshold by Elo
    const minHangingValue = elo <= 1100 ? 999999 : elo <= 1600 ? 850 : 280

    // Check if move hangs high-value piece to lower value piece without compensation
    if (cpLoss > 140 && movingVal >= minHangingValue && targetVal < movingVal) {
      const promo = candidateMove.length > 4 ? (candidateMove[4] as PieceSymbol) : undefined
      const moveRes = chess.move({
        from,
        to,
        promotion: promo,
      })

      if (moveRes) {
        const opponentTurn = chess.turn()

        // Immediate mate in 1 check (applicable to all Elo levels)
        if (chess.isCheckmate()) {
          return false // We delivered checkmate
        }

        // Did we allow immediate checkmate against us?
        const oppMoves = chess.moves({ verbose: true })
        const allowsImmediateMate = oppMoves.some((m) => {
          chess.move(m)
          const isMate = chess.isCheckmate()
          chess.undo()
          return isMate
        })

        if (allowsImmediateMate) {
          return true
        }

        // Is the newly moved piece immediately attacked and undefended?
        const isAttacked = chess.isAttacked(to, opponentTurn)
        if (isAttacked && movingVal >= minHangingValue) {
          return true
        }
      }
    }
  } catch {
    // If parsing fails, fall back to cpLoss threshold
    return cpLoss > 400
  }

  return false
}

export class SmartMoveSelector {
  /**
   * Selects a candidate move using a calibrated Boltzmann Softmax Distribution:
   *   P(move_i) = exp(-deltaCp_i / T) / sum_j(exp(-deltaCp_j / T))
   *
   * Higher T (e.g. 280 for Beginner) flattens probabilities across all candidates,
   * yielding ~58% accuracy. Lower T (e.g. 5 for Master) concentrates >97% probability
   * on the top engine candidate.
   */
  static select(
    candidates: MultiPVCandidate[],
    tierOrOptions: string | SelectMoveOptions,
    fen?: string,
    rng: Mulberry32 = new Mulberry32(Date.now()),
  ): MultiPVCandidate {
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidate moves provided to SmartMoveSelector")
    }

    // Normalize options
    let tierId = "club"
    let temperature = 65
    let elo = 1500
    let boardFen = fen
    let randomGen = rng

    if (typeof tierOrOptions === "string") {
      tierId = tierOrOptions
      const tempMap: Record<string, { temp: number; elo: number }> = {
        beginner: { temp: 280, elo: 800 },
        casual: { temp: 180, elo: 1100 },
        intermediate: { temp: 110, elo: 1350 },
        club: { temp: 65, elo: 1500 },
        adv: { temp: 35, elo: 1800 },
        expert: { temp: 15, elo: 2200 },
        master: { temp: 5, elo: 2500 },
        max: { temp: 0, elo: 3500 },
      }
      const mapped = tempMap[tierId] || tempMap.club
      temperature = mapped.temp
      elo = mapped.elo
    } else {
      tierId = tierOrOptions.tierId || "club"
      temperature = tierOrOptions.temperature !== undefined ? tierOrOptions.temperature : 65
      elo = tierOrOptions.elo || 1500
      boardFen = tierOrOptions.fen || fen
      randomGen = tierOrOptions.rng || rng
    }

    // Maximum preset or single candidate: immediately return best move
    if (candidates.length === 1 || tierId === "max" || temperature <= 0) {
      return candidates[0]
    }

    const valid = candidates.filter((c) => !isNaN(c.scoreCp) && isFinite(c.scoreCp))
    if (valid.length <= 1) return valid[0] ?? candidates[0]

    const bestScore = Math.max(...valid.map((c) => c.scoreCp))

    // ── Human Blunder & Inaccuracy Injection for Low Elo ──
    const blunderRoll = randomGen.next()
    if (elo <= 850 && blunderRoll < 0.14 && valid.length >= 3) {
      // Pick an inaccurate move from the bottom half of candidates
      const bottomCandidates = valid.slice(Math.floor(valid.length / 2))
      if (bottomCandidates.length > 0) {
        const idx = Math.floor(randomGen.next() * bottomCandidates.length)
        return bottomCandidates[idx]
      }
    } else if (elo <= 1150 && blunderRoll < 0.07 && valid.length >= 2) {
      // Pick a moderate inaccuracy (rank 2 or 3)
      const midCandidates = valid.slice(1, Math.min(4, valid.length))
      if (midCandidates.length > 0) {
        const idx = Math.floor(randomGen.next() * midCandidates.length)
        return midCandidates[idx]
      }
    }

    // ── Boltzmann Softmax Probability Calculation ──
    const scoredCandidates: { candidate: MultiPVCandidate; weight: number }[] = []

    for (let i = 0; i < valid.length; i++) {
      const c = valid[i]
      const cpLoss = Math.max(0, bestScore - c.scoreCp)

      // Tactical Sanity Guard
      if (boardFen && isTacticalBlunder(boardFen, c.move, cpLoss, elo)) {
        continue
      }

      // Boltzmann Weight: exp(-cpLoss / T)
      const weight = Math.exp(-cpLoss / temperature)
      if (weight > 0 && isFinite(weight)) {
        scoredCandidates.push({ candidate: c, weight })
      }
    }

    if (scoredCandidates.length === 0) {
      return valid[0]
    }

    // Normalize weights
    const totalWeight = scoredCandidates.reduce((sum, item) => sum + item.weight, 0)
    if (totalWeight <= 0) return scoredCandidates[0].candidate

    const roll = randomGen.next()
    let cumulative = 0

    for (const item of scoredCandidates) {
      cumulative += item.weight / totalWeight
      if (roll <= cumulative) {
        return item.candidate
      }
    }

    return scoredCandidates[0].candidate
  }
}
