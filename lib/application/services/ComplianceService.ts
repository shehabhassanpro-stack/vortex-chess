import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { GameContext } from "../../domain/types"
import { STRICT_BOT_ONLY_MODE } from "../../core/constants"

export interface ComplianceStatus {
  blocked: boolean
  showWarning: boolean
  context: GameContext
}

export class ComplianceService {
  constructor(
    private readonly contextProvider: IGameContextProvider,
    private readonly strictBotOnly: boolean = STRICT_BOT_ONLY_MODE,
  ) {}

  check(isForced: boolean): ComplianceStatus {
    const context = this.contextProvider.getContext()
    const permitted = this.contextProvider.isAnalysisPermitted(context)
    const isLive = context === "live"

    // If strict bot-only mode is active, live human games are strictly blocked even if forced.
    // If strict bot-only is false, standard permission and manual force overrides apply.
    const blocked = this.strictBotOnly
      ? isLive || (!permitted && !isForced)
      : !permitted && !isForced

    return {
      blocked,
      showWarning: isLive,
      context,
    }
  }
}
