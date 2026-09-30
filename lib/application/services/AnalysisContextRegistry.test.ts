import { describe, test, expect } from "vitest"
import { AnalysisContextRegistry } from "./AnalysisContextRegistry"
import type { AnalysisContext } from "../../core/types"

describe("AnalysisContextRegistry", () => {
  test("register and lookup contexts", () => {
    const registry = new AnalysisContextRegistry(60_000, false)
    const ctx: AnalysisContext = {
      correlationId: "c1",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      preset: null,
      speedMode: "fast",
      profile: { elo: 0, limitStrength: false },
      limits: { depth: 15 },
      sessionId: "s1",
      timestamp: Date.now(),
    }

    registry.register(ctx)
    expect(registry.lookup("c1")).toBe(ctx)
    expect(registry.lookup("unknown")).toBeUndefined()

    registry.destroy()
  })

  test("prune removes expired contexts", () => {
    const registry = new AnalysisContextRegistry(100, false)
    const oldCtx: AnalysisContext = {
      correlationId: "old",
      fen: "start",
      preset: null,
      speedMode: "fast",
      profile: { elo: 0, limitStrength: false },
      limits: {},
      sessionId: "s1",
      timestamp: Date.now() - 500, // 500ms ago
    }
    const freshCtx: AnalysisContext = {
      correlationId: "fresh",
      fen: "start",
      preset: null,
      speedMode: "fast",
      profile: { elo: 0, limitStrength: false },
      limits: {},
      sessionId: "s1",
      timestamp: Date.now(),
    }

    registry.register(oldCtx)
    registry.register(freshCtx)

    registry.prune(100)

    expect(registry.lookup("old")).toBeUndefined()
    expect(registry.lookup("fresh")).toBeDefined()

    registry.destroy()
  })
})
