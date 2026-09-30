import { describe, test, expect, vi } from "vitest"
import { AnalyzePositionUseCase } from "../../lib/application/useCases/AnalyzePositionUseCase"
import { AnalysisContextRegistry } from "../../lib/application/services/AnalysisContextRegistry"
import { ComplianceService } from "../../lib/application/services/ComplianceService"
import { ChessPosition } from "../../lib/domain/entities/ChessPosition"
import { EngineConfig } from "../../lib/domain/entities/EngineConfig"
import type { IEnginePort, AnalysisRequest } from "../../lib/domain/ports/IEnginePort"
import type { IGameContextProvider } from "../../lib/domain/ports/IGameContextProvider"

describe("Integration: Engine Communication & Context Lifecycle", () => {
  test("Orchestration: analyze request registers context with correlation ID and passes to engine port", async () => {
    let capturedRequest: AnalysisRequest | null = null

    const mockEnginePort: IEnginePort = {
      initialize: vi.fn().mockResolvedValue(undefined),
      analyze: vi.fn().mockImplementation((req: AnalysisRequest) => {
        capturedRequest = req
        return Promise.resolve()
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      getCaps: vi
        .fn()
        .mockResolvedValue({ eloMin: 1350, eloMax: 2850, supportsLimitStrength: true }),
      onOutput: vi.fn().mockReturnValue(() => {}),
      onCaps: vi.fn().mockReturnValue(() => {}),
      onFatalError: vi.fn().mockReturnValue(() => {}),
    }

    const registry = new AnalysisContextRegistry(60_000, false)
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("analysis"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const compliance = new ComplianceService(mockContext)

    const useCase = new AnalyzePositionUseCase(mockEnginePort, registry, compliance)

    const position = ChessPosition.fromFen(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "chess.js",
      1,
    )
    const correlationId = "corr-integration-test-999"
    const sessionId = "session-test-01"
    const config = EngineConfig.create(
      { elo: 1800, limitStrength: true },
      { depth: 15 },
      correlationId,
      sessionId,
    )

    const result = await useCase.execute(position, config, false, "normal", null)

    expect(result.blocked).toBe(false)
    expect(result.correlationId).toBe(correlationId)

    expect(capturedRequest).not.toBeNull()
    expect(capturedRequest?.correlationId).toBe(correlationId)
    expect(capturedRequest?.fen).toBe(position.fen)
    expect(capturedRequest?.profile.elo).toBe(1800)
    expect(capturedRequest?.limits.depth).toBe(15)

    // Context registry holds the active context
    const storedContext = registry.lookup(correlationId)
    expect(storedContext).toBeDefined()
    expect(storedContext?.fen).toBe(position.fen)
    expect(storedContext?.sessionId).toBe(sessionId)

    registry.destroy()
  })
})
