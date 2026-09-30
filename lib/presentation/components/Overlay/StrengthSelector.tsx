import React from "react"
import type { StrengthPreset } from "../../../engine/engineStrength"

export interface StrengthSelectorProps {
  availablePresets: StrengthPreset[]
  selectedPreset: StrengthPreset | null
  setSelectedPreset: (preset: StrengthPreset) => void
  isActive: boolean
}

export const StrengthSelector: React.FC<StrengthSelectorProps> = ({
  availablePresets,
  selectedPreset,
  setSelectedPreset,
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
    <>
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
        <span style={{ fontSize: "11px", color: "#8b949e", fontWeight: 600 }}>Strength:</span>
        <select
          value={selectedPreset?.id ?? "club"}
          onChange={(e) => {
            const preset = availablePresets.find((p) => p.id === e.target.value)
            if (preset) {
              setSelectedPreset(preset)
            }
          }}
          disabled={availablePresets.length === 0}
          style={selectStyle}
        >
          {availablePresets.map((p) => (
            <option key={p.id} value={p.id} style={{ background: "#161b22" }}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {selectedPreset?.mode === "weak-model" && (
        <div
          style={{
            marginBottom: "10px",
            fontSize: "10px",
            color: "#8b949e",
            background: "rgba(0,0,0,0.2)",
            padding: "4px 8px",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Human-like Mode</span>
          <span>{selectedPreset.description}</span>
        </div>
      )}
    </>
  )
}
