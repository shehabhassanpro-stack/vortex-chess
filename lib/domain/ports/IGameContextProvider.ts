import type { GameContext } from "../types"

export interface IGameContextProvider {
  getContext(): GameContext
  isAnalysisPermitted(context: GameContext): boolean
}
