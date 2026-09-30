import type { BoardArray } from "../types"

export interface BoardReading {
  boardArr: BoardArray
  boardEl: HTMLElement
  isFlipped: boolean
}

export interface IBoardReader {
  read(): BoardReading | null
  checkIsFlipped(element: HTMLElement): boolean
}
