/**
 * Chess Helper AI — Game Context Detection (Transitional Adapter)
 */

import { ChessComContextAdapter } from "../infrastructure/adapters/ChessComContextAdapter"
import type { GameContext } from "../domain/types"

const defaultAdapter = new ChessComContextAdapter()

export function getGameContext(): GameContext {
  return defaultAdapter.getContext()
}

export function isAnalysisAllowed(context: GameContext): boolean {
  return defaultAdapter.isAnalysisPermitted(context)
}
