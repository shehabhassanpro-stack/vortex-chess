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
    return {
      blocked: !permitted && !isForced,
      showWarning: context === "live",
      context,
    }
  }
}
