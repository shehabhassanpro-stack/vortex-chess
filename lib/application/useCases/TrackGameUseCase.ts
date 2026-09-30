import type { GameTracker, TrackerState } from "../../tracker/gameTracker"

export class TrackGameUseCase {
  constructor(private readonly tracker: GameTracker) {}

  sync(): TrackerState | null {
    return this.tracker.sync()
  }

  validateAgainstGeometric(geometricFen: string): boolean {
    return this.tracker.validateAgainstGeometric(geometricFen)
  }

  extractPliesCount(): number {
    return this.tracker.extractPliesCountOnly()
  }

  reset(): void {
    this.tracker.reset()
  }
}
