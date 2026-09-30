import React from "react"
import type {
  SpeedMode,
  GameContext,
  BrilliantResult,
  TimingRecommendation,
} from "../../../domain/types"
import type { StrengthPreset } from "../../../engine/engineStrength"
import { EngineMetrics } from "./EngineMetrics"
import { StrengthSelector } from "./StrengthSelector"
import { SpeedSelector } from "./SpeedSelector"
import { BoardPreview } from "./BoardPreview"
import { FairPlayBanner } from "./FairPlayBanner"
import { StandbyPanel } from "./StandbyPanel"
import { EngineErrorPanel } from "./EngineErrorPanel"
import { SettingsPanel } from "./SettingsPanel"

export interface OverlayProps {
  bestMove: string
  evaluation: string
  depth: number
  thinking: boolean
  currentFen: string
  isActive: boolean
  standby: boolean
  isFlipped: boolean
  fenSource: string
  speedMode: SpeedMode
  setSpeedMode: (val: SpeedMode) => void
  complianceBlocked: boolean
  availablePresets: StrengthPreset[]
  selectedPreset: StrengthPreset | null
  setSelectedPreset: (val: StrengthPreset) => void
  brilliantEnabled: boolean
  setBrilliantEnabled: (val: boolean) => void
  compactMode: boolean
  setCompactMode: (val: boolean) => void
  brilliantResult?: BrilliantResult | null
  timingGuidance?: TimingRecommendation | null
  startAnalysis: () => void
  stopAnalysis: () => void
  triggerAnalysis: (options: { forceAnalysis: boolean }) => void
  engineError?: string | null
  gameContext?: GameContext
}

export const ChessAssistantOverlay: React.FC<OverlayProps> = ({
  bestMove,
  evaluation,
  depth,
  thinking,
  currentFen,
  isActive,
  standby,
  isFlipped,
  fenSource,
  speedMode,
  setSpeedMode,
  complianceBlocked,
  availablePresets,
  selectedPreset,
  setSelectedPreset,
  brilliantEnabled,
  setBrilliantEnabled,
  compactMode,
  setCompactMode,
  brilliantResult,
  timingGuidance,
  startAnalysis,
  stopAnalysis,
  triggerAnalysis,
  engineError,
  gameContext = "unknown",
}) => {
  if (compactMode) {
    // In compact mode, render a minimal subtle trigger indicator in the top right corner
    return (
      <div
        id="vx-ghost"
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          background: "rgba(56, 189, 95, 0.35)",
          border: "1px solid rgba(56, 189, 95, 0.6)",
          cursor: "pointer",
          zIndex: 2147483647,
          boxShadow: "0 0 6px rgba(56, 189, 95, 0.4)",
          transition: "transform 0.15s ease, opacity 0.2s ease",
        }}
        title="Vortex Compact View Active — Click or press Alt+V / Alt+X to reveal"
        onClick={() => setCompactMode(false)}
      />
    )
  }

  return (
    <div
      id="vx-root"
      role="region"
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        padding: "16px 18px",
        background: "linear-gradient(145deg, rgba(13,17,23,0.96) 0%, rgba(22,27,34,0.96) 100%)",
        color: "#c9d1d9",
        borderRadius: "14px",
        zIndex: 2147483647,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: "13px",
        width: "clamp(240px, 20vw, 310px)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,95,0.25)",
        backdropFilter: "blur(16px)",
        pointerEvents: "auto",
        userSelect: "none",
        lineHeight: 1.5,
        transition: "box-shadow 0.3s ease",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "10px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "16px" }}>⚡</span>
          <span
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#38bd5f",
              letterSpacing: "0.3px",
            }}
          >
            Vortex
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={isActive ? stopAnalysis : startAnalysis}
            style={{
              background: isActive
                ? "linear-gradient(135deg,#cf222e,#a40e26)"
                : "linear-gradient(135deg,#238636,#1a7f37)",
              border: "none",
              color: "#fff",
              padding: "4px 11px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {isActive ? "Stop" : "Start"}
          </button>
        </div>
      </div>

      {/* Engine Error notification */}
      <EngineErrorPanel engineError={engineError ?? null} />

      {/* Fair Play Warning */}
      <FairPlayBanner gameContext={gameContext} isActive={isActive} />

      {/* Speed Mode Selector */}
      <SpeedSelector speedMode={speedMode} setSpeedMode={setSpeedMode} isActive={isActive} />

      {/* Strength Preset Selector */}
      <StrengthSelector
        availablePresets={availablePresets}
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        isActive={isActive}
      />

      {/* Settings & Options Panel (Brilliant + Compact Mode) */}
      <SettingsPanel
        brilliantEnabled={brilliantEnabled}
        setBrilliantEnabled={setBrilliantEnabled}
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        isActive={isActive}
      />

      {/* Engine Metrics */}
      <EngineMetrics
        evaluation={evaluation}
        depth={depth}
        thinking={thinking}
        fenSource={fenSource}
        complianceBlocked={complianceBlocked}
        isActive={isActive}
        engineError={engineError}
        brilliantResult={brilliantResult}
        timingGuidance={timingGuidance}
      />

      {/* Standby Panel if no board or unforced */}
      <StandbyPanel
        standby={standby}
        isActive={isActive}
        complianceBlocked={complianceBlocked}
        triggerAnalysis={triggerAnalysis}
      />

      {/* Live Board Preview & Arrows */}
      <BoardPreview
        currentFen={currentFen}
        isFlipped={isFlipped}
        bestMove={bestMove}
        isActive={isActive}
        standby={standby}
        complianceBlocked={complianceBlocked}
      />
    </div>
  )
}
