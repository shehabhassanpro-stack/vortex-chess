import { describe, test, expect, vi } from "vitest"
import { MoveReplayer } from "./MoveReplayer"

describe("MoveReplayer service", () => {
  test("replays valid move sequence from scratch", () => {
    const replayer = new MoveReplayer()
    const result = replayer.replay([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "Nf3", raw: "Nf3" },
    ])

    expect(result).not.toBeNull()
    expect(result?.plyCount).toBe(3)
    expect(result?.turn).toBe("b")
  })

  test("uses checkpoint for incremental replay", () => {
    const replayer = new MoveReplayer()
    const res1 = replayer.replay([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
    ])
    expect(res1?.plyCount).toBe(2)

    // Append 2 moves
    const res2 = replayer.replay([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "Nf3", raw: "Nf3" },
      { san: "Nc6", raw: "Nc6" },
    ])
    expect(res2?.plyCount).toBe(4)
    expect(res2?.turn).toBe("w")
  })

  test("invalidates checkpoint on takeback / branch divergence", () => {
    const replayer = new MoveReplayer()
    replayer.replay([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "Nf3", raw: "Nf3" },
    ])

    // Takeback Nf3 and play d4 instead
    const res2 = replayer.replay([
      { san: "e4", raw: "e4" },
      { san: "e5", raw: "e5" },
      { san: "d4", raw: "d4" },
    ])
    expect(res2?.plyCount).toBe(3)
    expect(res2?.turn).toBe("b")
  })

  test("returns null and triggers warning callback on invalid move", () => {
    const onWarning = vi.fn()
    const replayer = new MoveReplayer({ onWarning })
    const result = replayer.replay([
      { san: "e4", raw: "e4" },
      { san: "invalidMove", raw: "invalidMove" },
    ])

    expect(result).toBeNull()
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining("Failed to replay move [invalidMove] at ply 2"),
    )
  })
})
