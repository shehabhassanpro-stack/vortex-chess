import type { IBoardReader, BoardReading } from "../../domain/ports/IBoardReader"
import type { BoardArray } from "../../domain/types"
import { PIECE_MAP } from "../../domain/services/BoardEncoder"
import { BOARD_SELECTORS } from "../dom/selectors"

export class ChessComBoardAdapter implements IBoardReader {
  read(): BoardReading | null {
    const data = this.getBoardAndPieces()
    if (!data) return null

    const { board, pieces } = data
    const boardEl = board as HTMLElement
    const boardArr: BoardArray = Array.from({ length: 8 }, () => Array(8).fill(null))
    const isFlipped = this.checkIsFlipped(boardEl)

    for (const el of Array.from(pieces)) {
      const classes = Array.from(el.classList)
      let pieceChar: string | null = null
      let squareMatch: { col: number; row: number } | null = null

      for (const cls of classes) {
        if (cls.length === 2 && PIECE_MAP[cls]) {
          pieceChar = PIECE_MAP[cls]
        }
        const m = cls.match(/^square-(\d)(\d)$/)
        if (m) {
          const file = parseInt(m[1], 10)
          const rank = parseInt(m[2], 10)
          if (file >= 1 && file <= 8 && rank >= 1 && rank <= 8) {
            squareMatch = {
              col: file - 1,
              row: 8 - rank,
            }
          }
        }
      }

      if (!squareMatch && (el as HTMLElement).dataset?.square) {
        const sq = (el as HTMLElement).dataset.square!
        if (sq.length === 2) {
          const file = sq.charCodeAt(0) - 97
          const rank = parseInt(sq[1], 10)
          if (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
            squareMatch = { col: file, row: 8 - rank }
          }
        }
      }

      if (!pieceChar) continue

      if (squareMatch) {
        // square-XY and data-square are board coordinates where rank 8 is top when not flipped
        // In Chess.com DOM, square-11 is always a1 regardless of flip class
        const r = squareMatch.row
        const c = squareMatch.col
        boardArr[r][c] = pieceChar
      } else {
        // Fallback for headless testing environments without square-XY classes
        try {
          const boardRect = boardEl.getBoundingClientRect?.()
          const pieceRect = el.getBoundingClientRect?.()
          const width = boardEl.offsetWidth || boardRect?.width || 0
          if (boardRect && pieceRect && width > 0) {
            const squareSize = width / 8
            const cx = pieceRect.left + pieceRect.width / 2 - boardRect.left
            const cy = pieceRect.top + pieceRect.height / 2 - boardRect.top
            const col = Math.floor(cx / squareSize)
            const row = Math.floor(cy / squareSize)
            if (col >= 0 && col < 8 && row >= 0 && row < 8) {
              boardArr[isFlipped ? 7 - row : row][isFlipped ? 7 - col : col] = pieceChar
            }
          }
        } catch {
          // Ignore layout measurement failures
        }
      }
    }

    return { boardArr, boardEl, isFlipped }
  }

  checkIsFlipped(boardEl: Element | null): boolean {
    if (!boardEl) return false
    if (boardEl.classList.contains("flipped")) return true
    const cgWrap = boardEl.closest(".cg-wrap") ?? boardEl
    if (cgWrap.classList.contains("orientation-black")) return true
    return false
  }

  private getBoardAndPieces(): { board: Element; pieces: NodeListOf<Element> } | null {
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
}
