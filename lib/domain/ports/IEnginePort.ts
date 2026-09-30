import type { EngineProfile, SearchLimits } from "../types"

export interface AnalysisRequest {
  fen: string
  id: number
  correlationId: string
  profile: EngineProfile
  limits: SearchLimits
}

export interface EngineCaps {
  eloMin: number
  eloMax: number
  supportsLimitStrength: boolean
}

export interface EngineOutputPayload {
  data: string
  id: number
  correlationId: string
}

export interface IEnginePort {
  initialize(): Promise<void>
  analyze(request: AnalysisRequest): Promise<void>
  stop(correlationId?: string): Promise<void>
  getCaps(): Promise<EngineCaps>
  onOutput(handler: (payload: EngineOutputPayload) => void): () => void
  onCaps(handler: (caps: EngineCaps) => void): () => void
  onFatalError(handler: (error: string) => void): () => void
}
