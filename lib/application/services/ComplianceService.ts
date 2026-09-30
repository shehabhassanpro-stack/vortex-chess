import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { GameContext } from "../../domain/types"

export interface ComplianceStatus {
  blocked: boolean
  showWarning: boolean
  context: GameContext
}

export class ComplianceService {
  constructor(private readonly contextProvider: IGameContextProvider) {}

  check(isForced: boolean): ComplianceStatus {
    const context = this.contextProvider.getContext()
    const permitted = this.contextProvider.isAnalysisPermitted(context)
    const isLive = context === "live"

    // Hard Constraint: Live human games are strictly blocked even if forced.
    const blocked = isLive || (!permitted && !isForced)

    return {
      blocked,
      showWarning: isLive,
      context,
    }
  }
}
