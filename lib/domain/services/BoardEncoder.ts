import type { BoardArray } from "../types"

/** Maps Chess.com piece CSS class names to FEN piece characters. */
export const PIECE_MAP: Record<string, string> = {
  wp: "P",
  wn: "N",
  wb: "B",
  wr: "R",
  wq: "Q",
  wk: "K",
  bp: "p",
  bn: "n",
  bb: "b",
  br: "r",
  bq: "q",
  bk: "k",
}

/** Encodes an 8×8 board array as a compact string for diffing between frames. */
export function encodeBoardSig(arr: BoardArray): string {
  return arr.map((row) => row.map((c) => c ?? ".").join("")).join("|")
}
