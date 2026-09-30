import { Chess } from "chess.js"
import type { SanMove } from "../ports/IMoveListReader"

export interface ReplayResult {
  chess: Chess
  fen: string
  turn: "w" | "b"
  plyCount: number
}

export interface MoveReplayerOptions {
  onWarning?: (msg: string) => void
}

export class MoveReplayer {
  private checkpoint: { fen: string; sans: string[] } | null = null

  constructor(private readonly options: MoveReplayerOptions = {}) {}

  /**
   * Replays a sequence of SAN moves into a fresh or incremental Chess instance.
   * Returns null if any move fails to apply.
   */
  replay(moves: SanMove[]): ReplayResult | null {
    const sans = moves.map((m) => m.san)

    // Check if we can reuse our checkpoint
    let chessInstance: Chess
    let startIndex = 0

    if (this.canUseCheckpoint(sans)) {
      chessInstance = new Chess(this.checkpoint!.fen)
      startIndex = this.checkpoint!.sans.length
    } else {
      chessInstance = new Chess()
      startIndex = 0
    }

    for (let i = startIndex; i < moves.length; i++) {
      const { san, raw } = moves[i]
      try {
        const result = chessInstance.move(san)
        if (result === null) {
          this.warn(`Failed to replay move [${san}] at ply ${i + 1}. Raw: ${raw}`)
          this.checkpoint = null
          return null
        }
      } catch (e) {
        const errStr = e instanceof Error ? e.message : String(e)
        this.warn(`Failed to replay move [${san}] at ply ${i + 1}. Error: ${errStr}`)
        this.checkpoint = null
        return null
      }
    }

    const currentFen = chessInstance.fen()
    this.checkpoint = {
      fen: currentFen,
      sans: [...sans],
    }

    return {
      chess: chessInstance,
      fen: currentFen,
      turn: chessInstance.turn(),
      plyCount: sans.length,
    }
  }

  reset(): void {
    this.checkpoint = null
  }

  private canUseCheckpoint(newSans: string[]): boolean {
    if (!this.checkpoint) return false
    const cpSans = this.checkpoint.sans
    if (newSans.length < cpSans.length) return false

    for (let i = 0; i < cpSans.length; i++) {
      if (newSans[i] !== cpSans[i]) return false
    }
    return true
  }

  private warn(msg: string): void {
    this.options.onWarning?.(msg)
  }
}
