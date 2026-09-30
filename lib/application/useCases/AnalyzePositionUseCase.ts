import type { IEnginePort } from "../../domain/ports/IEnginePort"
import type { AnalysisContextRegistry } from "../services/AnalysisContextRegistry"
import type { ComplianceService } from "../services/ComplianceService"
import type { ChessPosition } from "../../domain/entities/ChessPosition"
import type { EngineConfig } from "../../domain/entities/EngineConfig"
import type { SpeedMode } from "../../domain/types"
import type { StrengthPreset } from "../../engine/engineStrength"
import type { AnalysisContext } from "../../core/types"

export class AnalyzePositionUseCase {
  private analysisSeq = 0

  constructor(
    private readonly enginePort: IEnginePort,
    private readonly contextRegistry: AnalysisContextRegistry,
    private readonly complianceService: ComplianceService,
  ) {}

  async execute(
    position: ChessPosition,
    config: EngineConfig,
    isForced: boolean,
    speedMode: SpeedMode,
    preset: StrengthPreset | null,
  ): Promise<{ correlationId: string; blocked: boolean }> {
    const compliance = this.complianceService.check(isForced)
    if (compliance.blocked) {
      return { correlationId: "", blocked: true }
    }

    const id = ++this.analysisSeq
    const correlationId = config.correlationId

    const ctx: AnalysisContext = {
      correlationId,
      fen: position.fen,
      preset,
      speedMode,
      profile: config.profile,
      limits: config.limits,
      sessionId: config.sessionId,
      timestamp: Date.now(),
    }
    this.contextRegistry.register(ctx)

    await this.enginePort.analyze({
      fen: position.fen,
      id,
      correlationId,
      profile: config.profile,
      limits: config.limits,
    })

    return { correlationId, blocked: false }
  }

  async stop(correlationId?: string): Promise<void> {
    await this.enginePort.stop(correlationId)
  }
}
