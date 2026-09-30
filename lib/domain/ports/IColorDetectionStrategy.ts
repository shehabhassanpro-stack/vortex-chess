import type { BoardArray, ActiveColor } from "../types"

export interface ColorDetectionContext {
  boardArr: BoardArray
  prevBoardSig: string
  prevTurn: ActiveColor | "unknown"
  isFlipped: boolean
}

export interface IColorDetectionStrategy {
  readonly name: string
  readonly priority: number
  /** Returns ActiveColor if determined, null if this strategy cannot decide */
  detect(context: ColorDetectionContext): ActiveColor | null
}
