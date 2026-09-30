import React from "react"

export interface EngineErrorPanelProps {
  engineError: string | null
}

export const EngineErrorPanel: React.FC<EngineErrorPanelProps> = ({ engineError }) => {
  if (!engineError) return null

  return (
    <div
      style={{
        background: "rgba(248,81,73,0.1)",
        border: "1px solid rgba(248,81,73,0.3)",
        borderRadius: "6px",
        padding: "6px 10px",
        marginBottom: "8px",
        fontSize: "11px",
        color: "#f85149",
        textAlign: "center",
        fontWeight: 600,
      }}
    >
      ⚠ {engineError}
    </div>
  )
}
