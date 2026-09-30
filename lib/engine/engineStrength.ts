/**
 * Vortex — Engine Strength & Search Limits (v3.1)
 *
 * Builds strength presets and EngineProfile objects for Vortex.
 *
 * Architecture:
 *   - Engine runs at full strength with expanded MultiPV (8–12 lines) to gather deep evaluation candidates.
 *   - SmartMoveSelector applies research-calibrated Boltzmann Softmax probability distributions.
 *   - Graded Tactical Sanity Guard prevents blunders only at appropriate Elo tiers.
 *   - Bounded Adaptive Search enforces simultaneous depth & movetime caps for responsive analysis.
 */

import type { EngineProfile, SearchLimits, SpeedMode, WeakMoveConfig } from "../core/types"

// ─── Types ────────────────────────────────────────────────────────────────

export interface StrengthPreset {
  /** Unique stable identifier for serialisation/comparison. */
  id: string
  /** Display label for the UI dropdown. */
  label: string
  /** Short description shown on hover or in settings. */
  description: string
  /** Mechanism: weak-model for humanization, maximum for uncapped engine */
  mode: "weak-model" | "uci-limit" | "maximum"
  /** Elo estimate */
  elo: number
  /** Populated for smart move selection */
  weakConfig?: WeakMoveConfig
}

// ─── Presets with Calibrated Boltzmann Temperatures ──────────────────────

export const VORTEX_PRESETS: StrengthPreset[] = [
  {
    id: "beginner",
    label: "🔰 Beginner (~800)",
    description: "Authentic human play: misses tactics, ~58% accuracy",
    mode: "weak-model",
    elo: 800,
    weakConfig: { enabled: true, temperature: 280, label: "Beginner" },
  },
  {
    id: "casual",
    label: "📗 Casual (~1100)",
    description: "Developing player: solid ideas, occasional tactical slips (~68%)",
    mode: "weak-model",
    elo: 1100,
    weakConfig: { enabled: true, temperature: 180, label: "Casual" },
  },
  {
    id: "intermediate",
    label: "📘 Intermediate (~1350)",
    description: "Sound positional foundation, minor inaccuracies (~78%)",
    mode: "weak-model",
    elo: 1350,
    weakConfig: { enabled: true, temperature: 110, label: "Intermediate" },
  },
  {
    id: "club",
    label: "📙 Club Player (~1500)",
    description: "Competent club strength, sharp tactical vision (~84%)",
    mode: "weak-model",
    elo: 1500,
    weakConfig: { enabled: true, temperature: 65, label: "Club Player" },
  },
  {
    id: "adv",
    label: "📕 Advanced (~1800)",
    description: "Strong amateur, high tactical precision (~89%)",
    mode: "weak-model",
    elo: 1800,
    weakConfig: { enabled: true, temperature: 35, label: "Advanced" },
  },
  {
    id: "expert",
    label: "🏅 Expert (~2200)",
    description: "Candidate master strength, near-optimal calculations (~94%)",
    mode: "weak-model",
    elo: 2200,
    weakConfig: { enabled: true, temperature: 15, label: "Expert" },
  },
  {
    id: "master",
    label: "🏆 Master (~2500)",
    description: "Grandmaster caliber precision (~97%)",
    mode: "weak-model",
    elo: 2500,
    weakConfig: { enabled: true, temperature: 5, label: "Master" },
  },
  {
    id: "max",
    label: "♛ Maximum",
    description: "Pure Stockfish — Uncapped 3500+ Elo (~99%+)",
    mode: "maximum",
    elo: 0,
    weakConfig: { enabled: false, temperature: 0, label: "Maximum" },
  },
]

/**
 * Build the complete list of available presets.
 */
export function buildAvailablePresets(_eloMin: number, _eloMax: number): StrengthPreset[] {
  return [...VORTEX_PRESETS]
}

// ─── Profile Builder ──────────────────────────────────────────────────────

/**
 * Build an EngineProfile from a selected preset.
 * Engine always runs at full strength so MultiPV search has clean evaluations.
 */
export function buildProfile(_preset: StrengthPreset): EngineProfile {
  return { elo: 0, limitStrength: false }
}

// ─── Search Limits Builder ────────────────────────────────────────────────

/**
 * Build SearchLimits from SpeedMode and optional preset.
 * Combines depth, movetime, and expanded MultiPV pool bounds.
 */
export function buildSearchLimits(speedMode: SpeedMode, _preset?: StrengthPreset): SearchLimits {
  switch (speedMode) {
    case "fast":
      return { movetime: 350, depth: 10, multipv: 8 }
    case "normal":
      return { movetime: 1200, depth: 14, multipv: 10 }
    case "deep":
      return { movetime: 3500, depth: 18, multipv: 12 }
  }
}
