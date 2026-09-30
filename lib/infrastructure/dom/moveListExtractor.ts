/**
 * Chess Helper AI — Move List Extractor (Transitional Adapter)
 */

import { ChessComMoveListAdapter } from "../adapters/ChessComMoveListAdapter"
import type { SanMove } from "../../domain/ports/IMoveListReader"

export { normaliseSan, looksLikeSan } from "../../domain/services/SanNormalizer"

const defaultAdapter = new ChessComMoveListAdapter()

export function findMoveListElement(): Element | null {
  return defaultAdapter.findContainer()
}

export function extractSanMoves(container: Element): SanMove[] {
  return defaultAdapter.extractMoves(container)
}
