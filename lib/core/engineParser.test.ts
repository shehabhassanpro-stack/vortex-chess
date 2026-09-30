import { describe, test, expect } from "vitest"
import { parseEngineInfo } from "./engineParser"

describe("engineParser", () => {
  test("should return empty results for non-info lines", () => {
    const parsed = parseEngineInfo("bestmove e2e4 ponder e7e5")
    expect(parsed.depth).toBeNull()
    expect(parsed.scoreCp).toBeNull()
    expect(parsed.scoreMate).toBeNull()
    expect(parsed.formattedScore).toBeNull()
  })

  test("should return empty results for info lines without pv", () => {
    // Engine might send info without pv (e.g. just depth and time)
    const parsed = parseEngineInfo("info depth 10 time 150 nodes 1000")
    expect(parsed.depth).toBeNull()
    expect(parsed.scoreCp).toBeNull()
  })

  test("should parse depth and positive centipawn score", () => {
    const parsed = parseEngineInfo(
      "info depth 15 seldepth 22 multipv 1 score cp 45 nodes 12345 nps 6789 time 123 pv e2e4 e7e5",
    )
    expect(parsed.depth).toBe(15)
    expect(parsed.scoreCp).toBe(45)
    expect(parsed.scoreMate).toBeNull()
    expect(parsed.formattedScore).toBe("+0.45")
  })

  test("should parse depth and negative centipawn score", () => {
    const parsed = parseEngineInfo("info depth 20 score cp -120 pv e2e4")
    expect(parsed.depth).toBe(20)
    expect(parsed.scoreCp).toBe(-120)
    expect(parsed.scoreMate).toBeNull()
    expect(parsed.formattedScore).toBe("-1.20")
  })

  test("should parse zero centipawn score correctly", () => {
    const parsed = parseEngineInfo("info depth 10 score cp 0 pv e2e4")
    expect(parsed.scoreCp).toBe(0)
    expect(parsed.formattedScore).toBe("+0.00")
  })

  test("should parse positive mate score", () => {
    const parsed = parseEngineInfo("info depth 18 score mate 3 pv e2e4")
    expect(parsed.depth).toBe(18)
    expect(parsed.scoreCp).toBeNull()
    expect(parsed.scoreMate).toBe(3)
    expect(parsed.formattedScore).toBe("M3")
  })

  test("should parse negative mate score", () => {
    const parsed = parseEngineInfo("info depth 18 score mate -2 pv e2e4")
    expect(parsed.scoreMate).toBe(-2)
    expect(parsed.formattedScore).toBe("M2")
  })
})
