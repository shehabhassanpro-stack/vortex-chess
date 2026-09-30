import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { GameContext } from "../../domain/types"
import { STRICT_BOT_ONLY_MODE } from "../../core/constants"

export class ChessComContextAdapter implements IGameContextProvider {
  constructor(private readonly strictBotOnly: boolean = STRICT_BOT_ONLY_MODE) {}

  getContext(): GameContext {
    const path = typeof window !== "undefined" ? window.location.pathname : ""
    if (path.startsWith("/play/online") || path.startsWith("/game/live")) return "live"
    if (path.startsWith("/play/computer")) return "computer"
    if (path.startsWith("/puzzles") || path.includes("puzzle")) return "puzzle"
    if (path.startsWith("/analysis") || path.startsWith("/game/archive")) return "analysis"
    if (path === "/" || path.startsWith("/home")) return "home"
    return "unknown"
  }

  isAnalysisPermitted(context: GameContext): boolean {
    if (this.strictBotOnly) {
      // Practice & Bot-Only Constraint:
      // Analysis is strictly permitted against computer bots, puzzles, and analysis reviews.
      return context === "computer" || context === "puzzle" || context === "analysis"
    }
    return context !== "home"
  }
}
