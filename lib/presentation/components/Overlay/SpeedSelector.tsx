import React from "react"
import type { SpeedMode } from "../../../domain/types"

export interface SpeedSelectorProps {
  speedMode: SpeedMode
  setSpeedMode: (val: SpeedMode) => void
  isActive: boolean
}

export const SpeedSelector: React.FC<SpeedSelectorProps> = ({
  speedMode,
  setSpeedMode,
  isActive: _isActive,
}) => {
  const selectStyle: React.CSSProperties = {
    background: "#161b22",
    color: "#c9d1d9",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "4px",
    padding: "3px 6px",
    fontSize: "11px",
    outline: "none",
    cursor: "pointer",
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "10px",
        background: "rgba(255,255,255,0.05)",
        padding: "6px 8px",
        borderRadius: "8px",
      }}
    >
      <span style={{ fontSize: "11px", color: "#8b949e", fontWeight: 600 }}>Speed:</span>
      <select
        value={speedMode}
        onChange={(e) => setSpeedMode(e.target.value as SpeedMode)}
        style={selectStyle}
      >
        <option value="fast" style={{ background: "#161b22" }}>
          ⚡ Fast (350ms)
        </option>
        <option value="normal" style={{ background: "#161b22" }}>
          🎯 Normal (1.2s)
        </option>
        <option value="deep" style={{ background: "#161b22" }}>
          🧠 Deep (3.5s)
        </option>
      </select>
    </div>
  )
}
