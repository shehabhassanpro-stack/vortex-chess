import React from "react"
import type { GameContext } from "../../../domain/types"
import { STRICT_BOT_ONLY_MODE } from "../../../core/constants"

export interface FairPlayBannerProps {
  gameContext: GameContext
  isActive: boolean
}

export const FairPlayBanner: React.FC<FairPlayBannerProps> = ({ gameContext, isActive }) => {
  if (gameContext !== "live" || !isActive) return null

  return (
    <div
      style={{
        background: "rgba(248,81,73,0.1)",
        border: "1px solid rgba(248,81,73,0.3)",
        borderRadius: "6px",
        padding: "6px 10px",
        marginBottom: "8px",
        fontSize: "10px",
        color: "#f85149",
        textAlign: "center",
        lineHeight: 1.4,
      }}
    >
      {STRICT_BOT_ONLY_MODE
        ? "⛔ Analysis disabled in live human games. Vortex is restricted to Bot/Computer practice games only."
        : "⚠️ Using analysis in live games violates Chess.com Fair Play policy"}
    </div>
  )
}
