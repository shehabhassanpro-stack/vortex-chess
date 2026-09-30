import { describe, it, expect } from "vitest"
import { BrilliantDetector } from "./BrilliantDetector"
import type { MultiPVCandidate } from "../types"

describe("BrilliantDetector — Multi-Candidate & Tactical Sacrifices", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  it("does not flag quiet opening moves as brilliant", () => {
    const candidates: MultiPVCandidate[] = [
      { pvIndex: 1, move: "e2e4", scoreCp: 30, depth: 15 },
      { pvIndex: 2, move: "d2d4", scoreCp: 25, depth: 15 },
    ]

    const res = BrilliantDetector.detect(candidates, startFen)
    expect(res.isBrilliant).toBe(false)
  })

  it("identifies sound tactical piece sacrifice as brilliant when candidate is top rank", () => {
    // Greek gift setup: White Bishop on d3 sacrifices on h7 (d3h7)
    const greekGiftFen = "r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P4/2PB1N2/PP1N1PPP/R1BQK2R w KQ - 0 8"

    const candidates: MultiPVCandidate[] = [
      { pvIndex: 1, move: "d3h7", scoreCp: 350, depth: 18 },
      { pvIndex: 2, move: "e1g1", scoreCp: 40, depth: 18 },
    ]

    const res = BrilliantDetector.detect(candidates, greekGiftFen)
    expect(res.isBrilliant).toBe(true)
    expect(res.sacrificedPiece).toBe("B")
    expect(res.move).toBe("d3h7")
  })

  it("identifies brilliant sacrifice even when it appears as candidate #2 in MultiPV pool", () => {
    const greekGiftFen = "r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P4/2PB1N2/PP1N1PPP/R1BQK2R w KQ - 0 8"

    // Candidate 1 is a quiet positional move, Candidate 2 is the crushing bishop sacrifice
    const candidates: MultiPVCandidate[] = [
      { pvIndex: 1, move: "e1g1", scoreCp: 200, depth: 18 },
      { pvIndex: 2, move: "d3h7", scoreCp: 350, depth: 18 },
    ]

    const res = BrilliantDetector.detect(candidates, greekGiftFen)
    expect(res.isBrilliant).toBe(true)
    expect(res.sacrificedPiece).toBe("B")
    expect(res.move).toBe("d3h7")
  })

  it("rejects unsound sacrifices with losing evaluation", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
    const candidates: MultiPVCandidate[] = [
      { pvIndex: 1, move: "d1h5", scoreCp: -400, depth: 15 },
      { pvIndex: 2, move: "g1f3", scoreCp: 20, depth: 15 },
    ]

    const res = BrilliantDetector.detect(candidates, fen)
    expect(res.isBrilliant).toBe(false)
  })

  it("detects pre-brilliant sacrifice sequence in PV lines", () => {
    const fen = "r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P4/2PB1N2/PP1N1PPP/R1BQK2R w KQ - 0 8"
    const candidates: MultiPVCandidate[] = [
      {
        pvIndex: 1,
        move: "e1g1",
        scoreCp: 250,
        depth: 18,
        pvLine: ["e1g1", "d3h7", "g8h7"],
      },
    ]

    const res = BrilliantDetector.detect(candidates, fen)
    expect(res.isPreBrilliant).toBe(true)
  })
})
