import { describe, it, expect } from "vitest"
import { HumanTimingModel } from "./HumanTimingModel"

describe("HumanTimingModel", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  const endgameFen = "8/8/4k3/8/8/4K3/4P3/8 w - - 0 45"

  it("provides book opening move timing in realistic range", () => {
    const timing = HumanTimingModel.calculateDelay(startFen)
    expect(timing.minDelayMs).toBeGreaterThanOrEqual(1000)
    expect(timing.maxDelayMs).toBeLessThanOrEqual(5000)
    expect(timing.targetDelayMs).toBeGreaterThanOrEqual(timing.minDelayMs)
    expect(timing.targetDelayMs).toBeLessThanOrEqual(timing.maxDelayMs)
  })

  it("provides reasonable delay for endgame positions", () => {
    const timing = HumanTimingModel.calculateDelay(endgameFen, false)
    expect(timing.minDelayMs).toBeGreaterThanOrEqual(1000)
    expect(timing.maxDelayMs).toBeLessThanOrEqual(6000)
  })
})
