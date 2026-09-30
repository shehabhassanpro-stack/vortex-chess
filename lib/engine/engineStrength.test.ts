import { describe, test, expect } from "vitest"
import {
  buildAvailablePresets,
  buildProfile,
  buildSearchLimits,
  VORTEX_PRESETS,
  type StrengthPreset,
} from "./engineStrength"

// ─── buildAvailablePresets ────────────────────────────────────────────────

describe("buildAvailablePresets", () => {
  test("returns all Vortex presets", () => {
    const presets = buildAvailablePresets(0, 0)
    expect(presets).toHaveLength(VORTEX_PRESETS.length)
  })

  test("Maximum is always the last preset", () => {
    const presets = buildAvailablePresets(0, 0)
    expect(presets[presets.length - 1].id).toBe("max")
    expect(presets[presets.length - 1].mode).toBe("maximum")
  })

  test("all presets have unique IDs", () => {
    const presets = buildAvailablePresets(0, 0)
    const ids = presets.map((p) => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ─── buildProfile ─────────────────────────────────────────────────────────

describe("buildProfile", () => {
  const makePreset = (mode: StrengthPreset["mode"], elo = 0): StrengthPreset => ({
    id: "test",
    label: "test",
    description: "test",
    mode,
    elo,
  })

  test("always returns full strength (limitStrength=false, elo=0) for accurate MultiPV", () => {
    expect(buildProfile(makePreset("weak-model"))).toEqual({ elo: 0, limitStrength: false })
    expect(buildProfile(makePreset("maximum"))).toEqual({ elo: 0, limitStrength: false })
  })
})

// ─── buildSearchLimits (Bounded Adaptive Search) ──────────────────────────

describe("buildSearchLimits", () => {
  test("fast → movetime 350ms, depth 10, multipv 8", () => {
    const limits = buildSearchLimits("fast")
    expect(limits.movetime).toBe(350)
    expect(limits.depth).toBe(10)
    expect(limits.multipv).toBe(8)
  })

  test("normal → movetime 1200ms, depth 14, multipv 10", () => {
    const limits = buildSearchLimits("normal")
    expect(limits.movetime).toBe(1200)
    expect(limits.depth).toBe(14)
    expect(limits.multipv).toBe(10)
  })

  test("deep → movetime 3500ms, depth 18, multipv 12", () => {
    const limits = buildSearchLimits("deep")
    expect(limits.movetime).toBe(3500)
    expect(limits.depth).toBe(18)
    expect(limits.multipv).toBe(12)
  })
})
