import type { BoardArray, ActiveColor } from "../types"

/**
 * Heuristically determine castling rights from piece positions.
 * Assumes rights exist if the King and Rooks are on their starting squares.
 *
 * @param boardArr - 8×8 array (rank 8 = index 0, rank 1 = index 7)
 */
export function getHeuristicCastling(boardArr: BoardArray): string {
  let castling = ""
  // White rights (rank 1 = index 7)
  if (boardArr[7]?.[4] === "K") {
    if (boardArr[7]?.[7] === "R") castling += "K"
    if (boardArr[7]?.[0] === "R") castling += "Q"
  }
  // Black rights (rank 8 = index 0)
  if (boardArr[0]?.[4] === "k") {
    if (boardArr[0]?.[7] === "r") castling += "k"
    if (boardArr[0]?.[0] === "r") castling += "q"
  }
  return castling || "-"
}

/**
 * Convert an 8×8 board array to a FEN position string.
 * Returns null only when the board contains zero pieces.
 */
export function boardToFenRows(
  board: BoardArray,
  activeColor: ActiveColor,
  castling = "-",
): string | null {
  const rows: string[] = []
  let hasPieces = false

  for (const row of board) {
    let fenRow = ""
    let empty = 0
    for (const cell of row) {
      if (cell === null) {
        empty++
      } else {
        hasPieces = true
        if (empty > 0) {
          fenRow += empty
          empty = 0
        }
        fenRow += cell
      }
    }
    if (empty > 0) fenRow += empty
    rows.push(fenRow)
  }

  if (!hasPieces) return null
  return `${rows.join("/")} ${activeColor} ${castling} - 0 1`
}
