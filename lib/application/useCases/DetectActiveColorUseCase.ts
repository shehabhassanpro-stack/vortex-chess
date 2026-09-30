import type {
  IColorDetectionStrategy,
  ColorDetectionContext,
} from "../../domain/ports/IColorDetectionStrategy"
import type { TurnResult } from "../../domain/types"

export class DetectActiveColorUseCase {
  private readonly sortedStrategies: IColorDetectionStrategy[]

  constructor(strategies: IColorDetectionStrategy[]) {
    this.sortedStrategies = [...strategies].sort((a, b) => a.priority - b.priority)
  }

  execute(ctx: ColorDetectionContext): TurnResult {
    for (const strategy of this.sortedStrategies) {
      const turn = strategy.detect(ctx)
      if (turn !== null) {
        return {
          turn,
          reliable: strategy.name !== "piece-count",
          source: strategy.name,
        }
      }
    }

    return {
      turn: "unknown",
      reliable: false,
      source: "none",
    }
  }
}
