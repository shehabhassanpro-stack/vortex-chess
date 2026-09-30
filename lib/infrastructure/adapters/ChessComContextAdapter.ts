import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { GameContext } from "../../domain/types"

export class ChessComContextAdapter implements IGameContextProvider {
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
    return context !== "home"
  }
}
