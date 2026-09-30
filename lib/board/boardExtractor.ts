/**
 * Chess Helper AI — Board Extractor (Transitional Adapter)
 */

import { ChessComBoardAdapter } from "../infrastructure/adapters/ChessComBoardAdapter"
import type { BoardArray } from "../domain/types"

export { encodeBoardSig } from "../domain/services/BoardEncoder"
export { getBoardAndPieces } from "./legacyDomHelper"

const defaultAdapter = new ChessComBoardAdapter()

export function checkIsFlipped(boardEl: Element | null): boolean {
  return defaultAdapter.checkIsFlipped(boardEl)
}

export function extractBoardArray(): {
  boardArr: BoardArray
  boardEl: HTMLElement
  isFlipped: boolean
} | null {
  return defaultAdapter.read()
}
