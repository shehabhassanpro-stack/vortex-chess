import React from "react"

export interface SettingsPanelProps {
  brilliantEnabled: boolean
  setBrilliantEnabled: (val: boolean) => void
  compactMode: boolean
  setCompactMode: (val: boolean) => void
  isActive?: boolean
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  brilliantEnabled,
  setBrilliantEnabled,
  compactMode,
  setCompactMode,
  isActive: _isActive,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        background: "rgba(255,255,255,0.03)",
        padding: "8px 10px",
        borderRadius: "8px",
        fontSize: "11px",
      }}
    >
      {/* Brilliant Seeker Toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: brilliantEnabled ? "#38bd5f" : "#8b949e",
          userSelect: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span>✨</span>
          <span>Brilliant Seeker</span>
        </span>
        <input
          type="checkbox"
          checked={brilliantEnabled}
          onChange={(e) => setBrilliantEnabled(e.target.checked)}
          style={{ cursor: "pointer", accentColor: "#238636" }}
        />
      </label>

      {/* Compact View Toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: compactMode ? "#a371f7" : "#8b949e",
          userSelect: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span>🛡️</span>
          <span>Compact View (Alt+V)</span>
        </span>
        <input
          type="checkbox"
          checked={compactMode}
          onChange={(e) => setCompactMode(e.target.checked)}
          style={{ cursor: "pointer", accentColor: "#8957e5" }}
        />
      </label>
    </div>
  )
}
