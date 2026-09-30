import React from "react"
import type { BrilliantResult, TimingRecommendation } from "../../../domain/types"

export interface EngineMetricsProps {
  evaluation: string
  depth: number
  thinking: boolean
  fenSource: string
  complianceBlocked: boolean
  isActive: boolean
  engineError?: string | null
  brilliantResult?: BrilliantResult | null
  timingGuidance?: TimingRecommendation | null
}

export const EngineMetrics: React.FC<EngineMetricsProps> = ({
  evaluation,
  depth,
  thinking,
  fenSource,
  complianceBlocked,
  isActive,
  engineError,
  brilliantResult,
  timingGuidance,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Primary Metrics Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(0,0,0,0.3)",
          padding: "8px 12px",
          borderRadius: "8px",
          minHeight: "36px",
        }}
      >
        {engineError ? (
          <span style={{ color: "#f85149", fontWeight: 600, fontSize: "11px" }}>
            ⚠ {engineError}
          </span>
        ) : complianceBlocked ? (
          <span style={{ color: "#f85149", fontWeight: 600, fontSize: "12px" }}>
            Blocked (Live Game)
          </span>
        ) : !isActive ? (
          <span style={{ color: "#8b949e", fontStyle: "italic", fontSize: "12px" }}>
            Engine inactive
          </span>
        ) : thinking ? (
          <span style={{ color: "#58a6ff", fontSize: "12px" }}>Analyzing…</span>
        ) : (
          <span
            style={{
              color: "#fff",
              fontWeight: "bold",
              fontSize: "14px",
              fontFamily: "monospace",
            }}
          >
            {evaluation || "0.00"}
          </span>
        )}

        {!engineError && !complianceBlocked && isActive && !thinking && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
            {timingGuidance && (
              <span
                style={{
                  color: "#a371f7",
                  fontSize: "10px",
                  background: "rgba(163, 113, 247, 0.15)",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  fontWeight: 500,
                }}
                title="Recommended human play window based on position complexity"
              >
                ⏱ {(timingGuidance.targetDelayMs / 1000).toFixed(1)}s
              </span>
            )}
            <span style={{ color: "#484f58", fontSize: "11px" }}>
              d{depth}
              {fenSource === "chess.js" && (
                <span style={{ color: "#238636", marginLeft: "4px" }}>✓</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Brilliant Move Notification Badges */}
      {!thinking && isActive && brilliantResult?.isBrilliant && (
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(35, 134, 54, 0.3) 0%, rgba(56, 189, 95, 0.2) 100%)",
            border: "1px solid rgba(56, 189, 95, 0.4)",
            borderRadius: "6px",
            padding: "5px 9px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 600,
            color: "#38bd5f",
            boxShadow: "0 0 12px rgba(56, 189, 95, 0.2)",
          }}
        >
          <span>✨</span>
          <span>Brilliant Opportunity ({brilliantResult.sacrificedPiece}!!)</span>
        </div>
      )}

      {!thinking &&
        isActive &&
        brilliantResult?.isPreBrilliant &&
        !brilliantResult?.isBrilliant && (
          <div
            style={{
              background: "rgba(56, 139, 253, 0.15)",
              border: "1px solid rgba(56, 139, 253, 0.3)",
              borderRadius: "6px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10.5px",
              color: "#58a6ff",
            }}
          >
            <span>🎯</span>
            <span>Brilliant sequence incoming</span>
          </div>
        )}
    </div>
  )
}
