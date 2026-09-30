import type { EngineProfile, SearchLimits } from "../types"

export class EngineConfig {
  readonly profileCacheKey: string

  private constructor(
    readonly profile: EngineProfile,
    readonly limits: SearchLimits,
    readonly correlationId: string,
    readonly sessionId: string,
  ) {
    this.profileCacheKey = `${profile.limitStrength}:${profile.elo}`
  }

  static create(
    profile: EngineProfile,
    limits: SearchLimits,
    correlationId: string,
    sessionId: string,
  ): EngineConfig {
    return new EngineConfig(profile, limits, correlationId, sessionId)
  }

  static maximum(correlationId: string, sessionId: string): EngineConfig {
    return new EngineConfig(
      { elo: 0, limitStrength: false },
      { depth: 18 },
      correlationId,
      sessionId,
    )
  }
}
