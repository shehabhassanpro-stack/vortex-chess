import type { ActiveColor, PositionSource } from "../types"

export class ChessPosition {
  readonly activeColor: ActiveColor

  private constructor(
    readonly fen: string,
    readonly source: PositionSource,
    readonly plyCount: number,
  ) {
    const parts = fen.split(" ")
    this.activeColor = (parts[1] === "b" ? "b" : "w") as ActiveColor
  }

  static fromFen(fen: string, source: PositionSource, plyCount = 0): ChessPosition {
    return new ChessPosition(fen, source, plyCount)
  }

  static startingPosition(): ChessPosition {
    return new ChessPosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "chess.js",
      0,
    )
  }

  equals(other: ChessPosition | null | undefined): boolean {
    if (!other) return false
    return this.fen === other.fen
  }

  isStarting(): boolean {
    return this.plyCount === 0 && this.activeColor === "w"
  }

  toDebugString(): string {
    return `[ChessPosition fen=${this.fen.split(" ")[0]} turn=${this.activeColor} plies=${this.plyCount} src=${this.source}]`
  }
}
