import { describe, test, expect } from "vitest"
import { selectWeakMove, Mulberry32, MultiPVCollector } from "./weakMoveModel"
import type { MultiPVCandidate, WeakMoveConfig } from "../core/types"

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeCandidates(scores: number[]): MultiPVCandidate[] {
  return scores.map((s, i) => ({
    pvIndex: i + 1,
    move: `move${i}`,
    scoreCp: s,
    depth: 12,
  }))
}

function makeConfig(temperature: number, enabled = true): WeakMoveConfig {
  return { enabled, temperature, label: "test" }
}

// ─── Mulberry32 PRNG ──────────────────────────────────────────────────────

describe("Mulberry32 PRNG", () => {
  test("same seed → identical sequence for 100 draws", () => {
    const a = new Mulberry32(42)
    const b = new Mulberry32(42)
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  test("different seeds → different first values", () => {
    const a = new Mulberry32(1)
    const b = new Mulberry32(2)
    expect(a.next()).not.toBe(b.next())
  })

  test("all values are in [0, 1)", () => {
    const rng = new Mulberry32(123)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  test("seed 0 is valid (does not produce NaN)", () => {
    const rng = new Mulberry32(0)
    const v = rng.next()
    expect(isNaN(v)).toBe(false)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  })
})

// ─── selectWeakMove ───────────────────────────────────────────────────────

describe("selectWeakMove", () => {
  test("disabled config → always returns first candidate (best)", () => {
    const candidates = makeCandidates([100, 50, -20])
    for (let seed = 0; seed < 50; seed++) {
      expect(selectWeakMove(candidates, makeConfig(200, false), new Mulberry32(seed)).move).toBe(
        "move0",
      )
    }
  })

  test("single candidate → returns it regardless of config", () => {
    const candidates = makeCandidates([100])
    const result = selectWeakMove(candidates, makeConfig(200), new Mulberry32(0))
    expect(result.move).toBe("move0")
  })

  test("empty candidates → returns undefined (caller must guard)", () => {
    // Edge case: should not crash — but result is undefined in JS
    const candidates: MultiPVCandidate[] = []
    const result = selectWeakMove(candidates, makeConfig(200), new Mulberry32(0))
    expect(result).toBeUndefined()
  })

  test("temperature near 0 → almost always picks best move", () => {
    const candidates = makeCandidates([100, 50, -20])
    const config = makeConfig(0.001)
    let bestCount = 0
    for (let seed = 0; seed < 200; seed++) {
      if (selectWeakMove(candidates, config, new Mulberry32(seed)).move === "move0") {
        bestCount++
      }
    }
    expect(bestCount).toBeGreaterThan(190) // > 95% picks best
  })

  test("high temperature + equal scores → distributes across all candidates", () => {
    const candidates = makeCandidates([100, 100, 100])
    const config = makeConfig(999)
    const counts = new Map<string, number>()
    for (let seed = 0; seed < 3000; seed++) {
      const move = selectWeakMove(candidates, config, new Mulberry32(seed)).move
      counts.set(move, (counts.get(move) ?? 0) + 1)
    }
    expect(counts.get("move0")!).toBeGreaterThan(800)
    expect(counts.get("move1")!).toBeGreaterThan(800)
    expect(counts.get("move2")!).toBeGreaterThan(800)
  })

  test("complexity adjustment: 2 candidates → picks best more often than 5", () => {
    // With 2 candidates, temperature is scaled by 0.4x → much less random
    const twoCandidates = makeCandidates([100, 0])
    const fiveCandidates = makeCandidates([100, 90, 80, 50, 0])
    const config = makeConfig(200)

    let bestCountTwo = 0
    let bestCountFive = 0
    for (let seed = 0; seed < 500; seed++) {
      if (selectWeakMove(twoCandidates, config, new Mulberry32(seed)).move === "move0")
        bestCountTwo++
      if (selectWeakMove(fiveCandidates, config, new Mulberry32(seed)).move === "move0")
        bestCountFive++
    }
    expect(bestCountTwo).toBeGreaterThan(bestCountFive) // Fewer candidates → more deterministic
  })

  test("clamps extreme scores to allow blunders even in overwhelmingly winning positions", () => {
    // Mate vs winning a queen. If not clamped, mate always wins.
    const candidates = makeCandidates([29999, 900])
    const config = makeConfig(200)

    let pickedWorse = false
    for (let seed = 0; seed < 500; seed++) {
      if (selectWeakMove(candidates, config, new Mulberry32(seed)).move === "move1") {
        pickedWorse = true
        break
      }
    }
    expect(pickedWorse).toBe(true)
  })

  test("candidates with NaN scores are filtered out", () => {
    const candidates: MultiPVCandidate[] = [
      { pvIndex: 1, move: "good", scoreCp: 100, depth: 10 },
      { pvIndex: 2, move: "nan", scoreCp: NaN, depth: 10 },
    ]
    const result = selectWeakMove(candidates, makeConfig(200), new Mulberry32(0))
    expect(result.move).not.toBe("nan")
  })

  test("returns deterministic result for fixed seed", () => {
    const candidates = makeCandidates([100, 80, 50, 20, -10])
    const config = makeConfig(150)
    const seed = 9999

    const a = selectWeakMove(candidates, config, new Mulberry32(seed))
    const b = selectWeakMove(candidates, config, new Mulberry32(seed))
    expect(a.move).toBe(b.move)
  })
})

// ─── MultiPVCollector ─────────────────────────────────────────────────────

describe("MultiPVCollector", () => {
  test("collects multiple PV lines and returns them sorted by pvIndex", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 12 multipv 2 score cp 50 pv d2d4 d7d5")
    collector.feedLine("info depth 12 multipv 1 score cp 100 pv e2e4 e7e5")
    collector.feedLine("info depth 12 multipv 3 score cp -10 pv c2c4 e7e5")

    const candidates = collector.harvest()
    expect(candidates).toHaveLength(3)
    expect(candidates[0]).toMatchObject({ pvIndex: 1, move: "e2e4", scoreCp: 100 })
    expect(candidates[1]).toMatchObject({ pvIndex: 2, move: "d2d4", scoreCp: 50 })
    expect(candidates[2]).toMatchObject({ pvIndex: 3, move: "c2c4", scoreCp: -10 })
  })

  test("ignores info lines without multipv keyword", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 20 score cp 100 pv e2e4 e7e5 d2d4")
    expect(collector.harvest()).toHaveLength(0)
  })

  test("ignores non-info lines", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("uciok")
    collector.feedLine("bestmove e2e4 ponder e7e5")
    expect(collector.harvest()).toHaveLength(0)
  })

  test("harvest() clears state — second harvest returns empty", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 12 multipv 1 score cp 100 pv e2e4 e7e5")
    expect(collector.harvest()).toHaveLength(1)
    expect(collector.harvest()).toHaveLength(0)
  })

  test("reset() clears without returning", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 12 multipv 1 score cp 100 pv e2e4")
    collector.reset()
    expect(collector.harvest()).toHaveLength(0)
  })

  test("mate scores converted to large centipawn values preserving ordering", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 20 multipv 1 score mate 3 pv e2e4 e7e5 d1h5")
    const candidates = collector.harvest()
    expect(candidates[0].scoreCp).toBe(30000 - 3) // 29997
  })

  test("negative mate scores (opponent mate) are large negative", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 20 multipv 1 score mate -2 pv e2e4")
    const candidates = collector.harvest()
    expect(candidates[0].scoreCp).toBe(-30000 - -2) // -29998
  })

  test("keeps deepest info line for each pvIndex", () => {
    const collector = new MultiPVCollector()
    // Shallow then deep info for pvIndex 1
    collector.feedLine("info depth 5  multipv 1 score cp 80 pv e2e4")
    collector.feedLine("info depth 15 multipv 1 score cp 95 pv d2d4")
    const candidates = collector.harvest()
    expect(candidates[0].scoreCp).toBe(95) // deeper one wins
    expect(candidates[0].depth).toBe(15)
  })

  test("deduplicates moves keeping the one with the highest pvIndex priority", () => {
    const collector = new MultiPVCollector()
    collector.feedLine("info depth 15 multipv 1 score cp 120 pv d2d4") // depth 15
    collector.feedLine("info depth 14 multipv 2 score cp 50 pv d2d4") // depth 14 stale
    const candidates = collector.harvest()
    expect(candidates).toHaveLength(1)
    expect(candidates[0].scoreCp).toBe(120)
  })
})
