import type { IMoveListReader, SanMove } from "../../domain/ports/IMoveListReader"
import { normaliseSan, looksLikeSan } from "../../domain/services/SanNormalizer"
import { MOVE_LIST_SELECTORS, MOVE_NODE_SELECTORS } from "../dom/selectors"
import { dbg } from "../../core/debug"

export class ChessComMoveListAdapter implements IMoveListReader {
  findContainer(): Element | null {
    for (const sel of MOVE_LIST_SELECTORS) {
      const el = document.querySelector(sel)
      if (el) {
        dbg("GameTracker", `[FEN-SOURCE] Move list found via selector: "${sel}"`)
        return el
      }
    }
    dbg("GameTracker", "[FEN-SOURCE] No move list element found")
    return null
  }

  extractMoves(container: Element): SanMove[] {
    // Strategy A: structured node selectors
    for (const sel of MOVE_NODE_SELECTORS) {
      const nodes = Array.from(container.querySelectorAll(sel))
      if (nodes.length === 0) continue

      const moves: SanMove[] = []
      for (const node of nodes) {
        const text = this.extractNodeSan(node)
        if (!text) continue
        const san = normaliseSan(text)
        if (looksLikeSan(san)) {
          const raw =
            node.nodeType === Node.ELEMENT_NODE
              ? (node as Element).outerHTML
              : node.textContent || ""
          moves.push({ san, raw })
        }
      }

      if (moves.length > 0) {
        dbg("GameTracker", `[FEN-SOURCE] Extracted ${moves.length} moves via selector "${sel}"`)
        return moves
      }
    }

    // Strategy B: parse raw text content of the whole container
    const raw = container.textContent ?? ""
    const tokens = raw
      .split(/\s+/)
      .map((t) => ({ san: normaliseSan(t), raw: t }))
      .filter((m) => looksLikeSan(m.san))

    if (tokens.length > 0) {
      dbg("GameTracker", `[FEN-SOURCE] Extracted ${tokens.length} moves via raw text fallback`)
    }
    return tokens
  }

  private extractNodeSan(node: Element): string {
    let san = ""
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element

        const piece = el.getAttribute("data-figurine")
        if (piece) {
          san += piece
        } else {
          const cls = el.className || ""
          if (typeof cls === "string") {
            if (cls.includes("knight")) san += "N"
            else if (cls.includes("bishop")) san += "B"
            else if (cls.includes("rook")) san += "R"
            else if (cls.includes("queen")) san += "Q"
            else if (cls.includes("king")) san += "K"
          }
        }
        san += el.textContent || ""
      } else if (child.nodeType === Node.TEXT_NODE) {
        san += child.textContent || ""
      }
    }
    return san
  }
}
