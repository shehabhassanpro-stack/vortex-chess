/**
 * Chess Helper AI — Shared Type Contracts (Transitional Re-export)
 */

export * from "../domain/types"

import type { EngineProfile, SearchLimits, WeakMoveConfig, SpeedMode } from "../domain/types"

// ─── Message Types ──────────────────────────────────────────────────────────

/** Sent by content script → background → offscreen for each position. */
export interface AnalyzeMessage {
  type: "ANALYZE"
  fen: string
  /** Monotonically increasing ID. Stale responses (id < current) are discarded. */
  id: number
  /** Universally unique identifier for this specific analysis request. */
  correlationId: string
  profile: EngineProfile
  limits: SearchLimits
}

/** Sent by content script to initialise the Stockfish offscreen document. */
export interface InitMessage {
  type: "INIT_ENGINE"
}

/** Sent by content script to halt the current analysis. */
export interface StopMessage {
  type: "STOP"
  /** Optional correlation ID to stop a specific analysis request. */
  correlationId?: string
}

export type OutgoingMessage = AnalyzeMessage | InitMessage | StopMessage

/** Sent by offscreen → background → content script for each UCI output line. */
export interface EngineOutputMessage {
  type: "ENGINE_OUTPUT"
  data: string
  id: number
  correlationId: string
}

/**
 * Sent once from the Offscreen document after the UCI handshake completes.
 * Carries the UCI_Elo range discovered from the engine response.
 */
export interface EngineCapsMessage {
  type: "ENGINE_CAPS"
  eloMin: number
  eloMax: number
  supportsLimitStrength: boolean
}

/** Sent when Stockfish engine crashes or suffers an unhandled error. */
export interface EngineFatalErrorMessage {
  type: "ENGINE_FATAL_ERROR"
  error?: string
}

export type IncomingMessage = EngineOutputMessage | EngineCapsMessage | EngineFatalErrorMessage

// ─── Analysis Context ────────────────────────────────────────────────────────

/** Snapshot of the analysis context when a request is made. Used to process the engine output correctly. */
export interface AnalysisContext {
  correlationId: string
  fen: string
  preset: { mode: string; weakConfig?: WeakMoveConfig } | null
  speedMode: SpeedMode
  profile: EngineProfile
  limits: SearchLimits
  sessionId: string
  timestamp: number
}
