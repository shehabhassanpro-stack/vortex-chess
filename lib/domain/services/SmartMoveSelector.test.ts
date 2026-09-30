import { describe, it, expect } from "vitest"
import { SmartMoveSelector, isTacticalBlunder } from "./SmartMoveSelector"
import { Mulberry32 } from "../../engine/weakMoveModel"
import type { MultiPVCandidate } from "../types"

describe("SmartMoveSelector — Boltzmann Distribution & True Elo Scaling", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  const mockOpeningCandidates: MultiPVCandidate[] = [
    { pvIndex: 1, move: "e2e4", scoreCp: 40, depth: 14 },
    { pvIndex: 2, move: "d2d4", scoreCp: 35, depth: 14 },
    { pvIndex: 3, move: "c2c4", scoreCp: 10, depth: 14 },
    { pvIndex: 4, move: "g1f3", scoreCp: 5, depth: 14 },
    { pvIndex: 5, move: "b1c3", scoreCp: -30, depth: 14 },
    { pvIndex: 6, move: "g2g3", scoreCp: -80, depth: 14 },
    { pvIndex: 7, move: "b2b3", scoreCp: -140, depth: 14 },
    { pvIndex: 8, move: "a2a3", scoreCp: -200, depth: 14 },
  ]

  const mockTacticalCandidates: MultiPVCandidate[] = [
    { pvIndex: 1, move: "d3h7", scoreCp: 350, depth: 16 },
    { pvIndex: 2, move: "e1g1", scoreCp: 50, depth: 16 },
    { pvIndex: 3, move: "c1e3", scoreCp: 20, depth: 16 },
    { pvIndex: 4, move: "a1c1", scoreCp: 0, depth: 16 },
  ]

  it("always returns best move for 'max' tier", () => {
    const selected = SmartMoveSelector.select(mockOpeningCandidates, "max", startFen)
    expect(selected.move).toBe("e2e4")
  })

  it("selects decisive tactical moves with >95% probability for Master tier (T=5)", () => {
    const counts: Record<string, number> = {}
    for (let seed = 1; seed <= 100; seed++) {
      const rng = new Mulberry32(seed)
      const res = SmartMoveSelector.select(
        mockTacticalCandidates,
        { tierId: "master", temperature: 5, elo: 2500, fen: startFen, rng },
        startFen,
        rng,
      )
      counts[res.move] = (counts[res.move] || 0) + 1
    }

    // In tactical positions, Master strongly executes the winning sacrifice >= 95%
    expect(counts["d3h7"]).toBeGreaterThanOrEqual(95)
  })

  it("produces human-like spread across candidates for Beginner tier (T=280)", () => {
    const counts: Record<string, number> = {}
    for (let seed = 1; seed <= 200; seed++) {
      const rng = new Mulberry32(seed)
      const res = SmartMoveSelector.select(
        mockOpeningCandidates,
        { tierId: "beginner", temperature: 280, elo: 800, fen: startFen, rng },
        startFen,
        rng,
      )
      counts[res.move] = (counts[res.move] || 0) + 1
    }

    // Beginner should not play only e2e4; should pick multiple moves across the pool
    const uniqueMoves = Object.keys(counts)
    expect(uniqueMoves.length).toBeGreaterThanOrEqual(4)
    // Best move percentage should be authentically low (~20-50%), not 90%+
    expect(counts["e2e4"]).toBeLessThan(120)
  })

  it("Tactical Sanity Guard detects hanging major pieces on High Elo", () => {
    const hangingKnightFen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    const blunder = isTacticalBlunder(hangingKnightFen, "f3g5", 300, 1800)
    expect(blunder).toBe(true)
  })

  it("Tactical Sanity Guard permits low-Elo human inaccuracies (Elo <= 1100)", () => {
    const hangingKnightFen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    // At beginner Elo (800), non-mate blunders are allowed
    const blunder = isTacticalBlunder(hangingKnightFen, "f3g5", 300, 800)
    expect(blunder).toBe(false)
  })
})
