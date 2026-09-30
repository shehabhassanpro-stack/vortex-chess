import { describe, test, expect, vi } from "vitest"
import { AnalyzePositionUseCase } from "./AnalyzePositionUseCase"
import { AnalysisContextRegistry } from "../services/AnalysisContextRegistry"
import { ComplianceService } from "../services/ComplianceService"
import { ChessPosition } from "../../domain/entities/ChessPosition"
import { EngineConfig } from "../../domain/entities/EngineConfig"
import type { IEnginePort } from "../../domain/ports/IEnginePort"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"

describe("AnalyzePositionUseCase", () => {
  test("triggers analysis when compliance allows", async () => {
    const mockEnginePort: IEnginePort = {
      initialize: vi.fn(),
      analyze: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getCaps: vi.fn().mockResolvedValue({ eloMin: 0, eloMax: 0, supportsLimitStrength: false }),
      onOutput: vi.fn().mockReturnValue(() => {}),
      onCaps: vi.fn().mockReturnValue(() => {}),
      onFatalError: vi.fn().mockReturnValue(() => {}),
    }

    const registry = new AnalysisContextRegistry(60_000, false)
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("computer"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const compliance = new ComplianceService(mockContext)

    const useCase = new AnalyzePositionUseCase(mockEnginePort, registry, compliance)
    const pos = ChessPosition.startingPosition()
    const config = EngineConfig.maximum("corr-123", "sess-1")

    const res = await useCase.execute(pos, config, false, "fast", null)

    expect(res.blocked).toBe(false)
    expect(res.correlationId).toBe("corr-123")
    expect(mockEnginePort.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        fen: pos.fen,
        correlationId: "corr-123",
      }),
    )

    registry.destroy()
  })

  test("blocks analysis on disallowed context unless forced", async () => {
    const mockEnginePort: IEnginePort = {
      initialize: vi.fn(),
      analyze: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getCaps: vi.fn(),
      onOutput: vi.fn().mockReturnValue(() => {}),
      onCaps: vi.fn().mockReturnValue(() => {}),
      onFatalError: vi.fn().mockReturnValue(() => {}),
    }

    const registry = new AnalysisContextRegistry(60_000, false)
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("home"),
      isAnalysisPermitted: vi.fn().mockReturnValue(false),
    }
    const compliance = new ComplianceService(mockContext)

    const useCase = new AnalyzePositionUseCase(mockEnginePort, registry, compliance)
    const pos = ChessPosition.startingPosition()
    const config = EngineConfig.maximum("corr-123", "sess-1")

    const resBlocked = await useCase.execute(pos, config, false, "fast", null)
    expect(resBlocked.blocked).toBe(true)
    expect(mockEnginePort.analyze).not.toHaveBeenCalled()

    const resForced = await useCase.execute(pos, config, true, "fast", null)
    expect(resForced.blocked).toBe(false)
    expect(mockEnginePort.analyze).toHaveBeenCalled()

    registry.destroy()
  })
})
