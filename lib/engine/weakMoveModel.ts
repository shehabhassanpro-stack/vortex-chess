/**
 * Chess Helper AI — Weak Move Model
 *
 * Implements Boltzmann (softmax) move selection over MultiPV candidates
 * to simulate human-like errors at sub-Stockfish strength levels.
 *
 * Design principles:
 *   - Never produces illegal moves (all candidates come from Stockfish)
 *   - Never mixes depth + movetime (search parameters are caller's concern)
 *   - Deterministic with a seeded PRNG (Mulberry32) for reproducible tests
 *   - Position complexity adjusts temperature to avoid bizarre blunders
 *     in forced/simple positions
 *
 * References:
 *   - Boltzmann distribution for move selection: stackexchange.com/chess
 *   - Mulberry32 PRNG: github.com/nicfv/prng
 */

import type { MultiPVCandidate, WeakMoveConfig } from "../core/types"

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────

/**
 * Fast, deterministic pseudo-random number generator.
 * Use a fixed seed in tests to guarantee reproducibility.
 * Use `Date.now()` as seed in production.
 *
 * @example
 * const rng = new Mulberry32(42)
 * const value = rng.next() // always 0.457... for seed 42
 */
export class Mulberry32 {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Complexity Adjustment ────────────────────────────────────────────────

/**
 * Scale the temperature based on position complexity.
 *
 * Rationale:
 *   - In positions with few legal moves (endgame, forced sequences),
 *     even weak players find the right move. Reduce τ to reflect this.
 *   - In quiet positions (small eval spread), all moves are similar —
 *     errors are less impactful and less likely.
 *   - In tactical positions (large spread), mistakes are more natural.
 *
 * This prevents the model from producing bizarre blunders in trivially
 * simple positions, which would feel unrealistic.
 */
function adjustTemperatureForComplexity(
  baseTemperature: number,
  candidates: MultiPVCandidate[],
): number {
  if (candidates.length <= 2) {
    // Very few alternatives (forced moves) → reduce randomness significantly
    return baseTemperature * 0.4
  }

  // Boltzmann naturally handles complexity (small cpLoss = random, large cpLoss = avoids blunders).
  // No need to manually tweak temperature based on spread.
  return baseTemperature
}

// ─── Boltzmann Move Selection ─────────────────────────────────────────────

/**
 * Select a move from MultiPV candidates using a Boltzmann distribution.
 *
 * Formula:
 *   P(move_i) = exp(-(bestScore - score_i) / τ) / Σ exp(-(bestScore - score_j) / τ)
 *
 * Where τ (temperature) controls randomness:
 *   τ → 0:   always picks the best move
 *   τ → ∞:   picks uniformly at random
 *
 * The temperature is further adjusted by position complexity before sampling.
 *
 * @param candidates - MultiPV results, sorted by pvIndex ascending
 * @param config     - Weak move configuration (temperature, enabled flag)
 * @param rng        - PRNG instance (injected for testability)
 * @returns The selected candidate (never null; falls back to best on edge cases)
 */
export function selectWeakMove(
  candidates: MultiPVCandidate[],
  config: WeakMoveConfig,
  rng: Mulberry32,
): MultiPVCandidate {
  // If disabled or only one candidate, return best immediately
  if (!config.enabled || candidates.length === 0) return candidates[0]

  // Filter out candidates with NaN scores (engine parse error)
  const valid = candidates.filter((c) => !isNaN(c.scoreCp) && isFinite(c.scoreCp))
  if (valid.length <= 1) return valid[0] ?? candidates[0]

  // Clamp scores to [-1000, 1000] to prevent Mate scores from breaking the distribution,
  // and to compress extreme advantages so weak bots can still blunder in won positions.
  const clampedValid = valid.map((c) => ({
    ...c,
    scoreCp: Math.max(-1000, Math.min(1000, c.scoreCp)),
  }))

  const bestScore = Math.max(...clampedValid.map((c) => c.scoreCp))
  const temperature = adjustTemperatureForComplexity(config.temperature, valid)

  // Compute Boltzmann weights using centipawn loss from best
  const weights = clampedValid.map((c) => {
    const cpLoss = bestScore - c.scoreCp // always >= 0
    return Math.exp(-cpLoss / temperature)
  })

  // Normalise to probabilities
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  if (totalWeight === 0 || !isFinite(totalWeight)) return valid[0]

  // Sample from the distribution
  const roll = rng.next()
  let cumulative = 0
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i] / totalWeight
    if (roll < cumulative) return valid[i]
  }

  // Floating-point edge case: return last element
  return valid[valid.length - 1]
}

// ─── MultiPV Collector ────────────────────────────────────────────────────

/**
 * Stateful collector for MultiPV UCI output lines.
 *
 * Instantiated in the content script, fed ENGINE_OUTPUT lines one at a time.
 * When `bestmove` is received, call `harvest()` to retrieve all candidates
 * for the current position.
 *
 * Thread safety: single-threaded JS — no concerns.
 */
export class MultiPVCollector {
  private candidates: Map<number, MultiPVCandidate> = new Map()

  /**
   * Feed one UCI output line. Only `info multipv` lines are processed.
   * Non-MultiPV lines are ignored without error.
   */
  feedLine(line: string): void {
    if (!line.startsWith("info") || !line.includes(" multipv ")) return

    const pvMatch = line.match(/\bmultipv\s+(\d+)/)
    const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)
    const depthMatch = line.match(/\bdepth\s+(\d+)/)
    const pvMoveMatch = line.match(/\bpv\s+(\S+)/)
    const pvFullMatch = line.match(/\bpv\s+(.+)$/)

    if (!pvMatch || !scoreMatch || !pvMoveMatch) return

    const pvIndex = parseInt(pvMatch[1], 10)
    const [, scoreType, scoreRaw] = scoreMatch
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0
    const move = pvMoveMatch[1]
    const pvLine = pvFullMatch ? pvFullMatch[1].trim().split(/\s+/) : [move]

    // Convert mate scores to large centipawn equivalents for consistent comparison
    let scoreCp: number
    if (scoreType === "cp") {
      scoreCp = parseInt(scoreRaw, 10)
    } else {
      // mate in N → sign * (30000 - |N|)  (preserves ordering)
      const mateN = parseInt(scoreRaw, 10)
      scoreCp = mateN > 0 ? 30000 - mateN : -30000 - mateN
    }

    // Keep only the latest (deepest) info line for each pvIndex
    const existing = this.candidates.get(pvIndex)
    if (!existing || depth >= existing.depth) {
      this.candidates.set(pvIndex, { pvIndex, move, scoreCp, depth, pvLine })
    }
  }

  /**
   * Return all collected candidates sorted by pvIndex ascending, then clear.
   * Call this when `bestmove` is received.
   */
  harvest(): MultiPVCandidate[] {
    const raw = Array.from(this.candidates.values()).sort((a, b) => a.pvIndex - b.pvIndex)
    this.candidates.clear()

    // Deduplicate by move (keeps the highest ranked PV for that move)
    const seen = new Set<string>()
    const result: MultiPVCandidate[] = []
    for (const c of raw) {
      if (!seen.has(c.move)) {
        seen.add(c.move)
        result.push(c)
      }
    }
    return result
  }

  /** Clear state without returning candidates (e.g. on new position). */
  reset(): void {
    this.candidates.clear()
  }
}
