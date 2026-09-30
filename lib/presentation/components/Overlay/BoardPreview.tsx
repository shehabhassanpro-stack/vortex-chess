import React from "react"
import { Chessboard } from "react-chessboard"
import type { Square } from "chess.js"

export interface BoardPreviewProps {
  currentFen: string
  isFlipped: boolean
  bestMove: string
  isActive: boolean
  standby: boolean
  complianceBlocked: boolean
}

export const BoardPreview: React.FC<BoardPreviewProps> = ({
  currentFen,
  isFlipped,
  bestMove,
  isActive,
  standby,
  complianceBlocked,
}) => {
  const getCustomArrows = (): [Square, Square][] => {
    if (!bestMove || bestMove.length < 4) return []
    return [[bestMove.substring(0, 2) as Square, bestMove.substring(2, 4) as Square]]
  }

  if (complianceBlocked || !isActive || standby) return null

  return (
    <>
      <div
        style={{
          marginTop: "12px",
          marginBottom: "12px",
          borderRadius: "6px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <Chessboard
          position={currentFen}
          boardOrientation={isFlipped ? "black" : "white"}
          customArrows={getCustomArrows()}
          customArrowColor="rgba(56, 189, 95, 0.8)"
          arePiecesDraggable={false}
        />
      </div>

      {bestMove && (
        <div style={{ textAlign: "center", marginTop: "12px" }}>
          <span style={{ color: "#8b949e", fontSize: "11px", marginRight: "6px" }}>Best Move</span>
          <span
            style={{
              color: "#38bd5f",
              fontWeight: "bold",
              fontSize: "16px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {bestMove}
          </span>
        </div>
      )}
    </>
  )
}
