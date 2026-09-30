import { BOARD_SELECTORS } from "../infrastructure/dom/selectors"

export function getBoardAndPieces(): { board: Element; pieces: NodeListOf<Element> } | null {
  const chessBoard = document.querySelector(BOARD_SELECTORS.BOARD)
  if (chessBoard) {
    if (chessBoard.shadowRoot) {
      const pieces = chessBoard.shadowRoot.querySelectorAll(BOARD_SELECTORS.PIECE)
      if (pieces.length > 0) return { board: chessBoard, pieces }
    }
    const pieces = chessBoard.querySelectorAll(BOARD_SELECTORS.PIECE)
    if (pieces.length > 0) return { board: chessBoard, pieces }
  }

  const docPieces = document.querySelectorAll(BOARD_SELECTORS.PIECE)
  if (docPieces.length > 0) {
    const board = docPieces[0].closest("chess-board, .board, [id*='board']") ?? document.body
    return { board, pieces: docPieces }
  }

  return null
}
