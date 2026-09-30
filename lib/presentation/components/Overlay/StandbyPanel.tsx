import React from "react"

export interface StandbyPanelProps {
  standby: boolean
  isActive: boolean
  complianceBlocked: boolean
  triggerAnalysis: (options: { forceAnalysis: boolean }) => void
}

export const StandbyPanel: React.FC<StandbyPanelProps> = ({
  standby,
  isActive,
  complianceBlocked,
  triggerAnalysis,
}) => {
  if (!standby || !isActive || complianceBlocked) return null

  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div
        style={{
          color: "#d29922",
          fontSize: "12px",
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        Standby: No Game
      </div>
      <button
        onClick={() => triggerAnalysis({ forceAnalysis: true })}
        style={{
          width: "100%",
          background: "rgba(210,153,34,0.1)",
          border: "1px solid rgba(210,153,34,0.3)",
          color: "#d29922",
          padding: "6px 0",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "bold",
        }}
      >
        Force Start
      </button>
    </div>
  )
}
