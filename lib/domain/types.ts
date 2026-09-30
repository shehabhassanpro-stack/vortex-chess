/**
 * Chess Helper AI — Domain Type Contracts
 *
 * Pure domain types with no dependencies on Browser/DOM/React APIs.
 */

// ─── Engine Profile & Limits ────────────────────────────────────────────────

export interface EngineProfile {
  /** 0 = Maximum strength (no limit). >0 = UCI_Elo value. */
  elo: number
  limitStrength: boolean
}

export interface SearchLimits {
  depth?: number
  movetime?: number
  multipv?: number
}

// ─── Weak Move Model & Candidate Types ─────────────────────────────────────

export interface WeakMoveConfig {
  enabled: boolean
  temperature: number
  label: string
}

export interface MultiPVCandidate {
  pvIndex: number
  move: string
  scoreCp: number
  depth: number
  pvLine?: string[]
}

// ─── Brilliant Move Engine Types ──────────────────────────────────────────

export interface BrilliantResult {
  isBrilliant: boolean
  isPreBrilliant: boolean
  move: string
  reason?: string
  sacrificedPiece?: string
}

// ─── User Settings & Persistence ──────────────────────────────────────────

export interface UserSettings {
  presetId: string
  speedMode: SpeedMode
  brilliantEnabled: boolean
  compactMode: boolean
}

// ─── Human Timing Guidance ────────────────────────────────────────────────

export interface TimingRecommendation {
  minDelayMs: number
  maxDelayMs: number
  targetDelayMs: number
}

// ─── Game & Board State ─────────────────────────────────────────────────────

export type GameContext = "live" | "computer" | "puzzle" | "analysis" | "home" | "unknown"

export type BoardArray = (string | null)[][]

export type ActiveColor = "w" | "b"

export interface TurnResult {
  turn: ActiveColor | "unknown"
  reliable: boolean
  source?: string
}

export type PositionSource = "chess.js" | "geometric" | "geometric-puzzle" | "puzzle-tracking"

export type SpeedMode = "fast" | "normal" | "deep"
