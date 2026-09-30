import { describe, test, expect } from "vitest"
import { DetectActiveColorUseCase } from "./DetectActiveColorUseCase"
import type {
  IColorDetectionStrategy,
  ColorDetectionContext,
} from "../../domain/ports/IColorDetectionStrategy"

describe("DetectActiveColorUseCase", () => {
  const dummyCtx: ColorDetectionContext = {
    boardArr: [],
    prevBoardSig: "",
    prevTurn: "unknown",
    isFlipped: false,
  }

  test("executes strategies in priority order and returns first matching", () => {
    const s1: IColorDetectionStrategy = {
      name: "low-priority",
      priority: 10,
      detect: () => "w",
    }
    const s2: IColorDetectionStrategy = {
      name: "high-priority",
      priority: 1,
      detect: () => "b",
    }

    const useCase = new DetectActiveColorUseCase([s1, s2])
    const res = useCase.execute(dummyCtx)

    expect(res.turn).toBe("b")
    expect(res.reliable).toBe(true)
    expect(res.source).toBe("high-priority")
  })

  test("piece-count strategy is marked as unreliable", () => {
    const sPiece: IColorDetectionStrategy = {
      name: "piece-count",
      priority: 5,
      detect: () => "w",
    }

    const useCase = new DetectActiveColorUseCase([sPiece])
    const res = useCase.execute(dummyCtx)

    expect(res.turn).toBe("w")
    expect(res.reliable).toBe(false)
  })

  test("returns unknown when all strategies return null", () => {
    const sNull: IColorDetectionStrategy = {
      name: "empty",
      priority: 1,
      detect: () => null,
    }

    const useCase = new DetectActiveColorUseCase([sNull])
    const res = useCase.execute(dummyCtx)

    expect(res.turn).toBe("unknown")
    expect(res.reliable).toBe(false)
  })
})
