import type { PlasmoCSConfig } from "plasmo"
import { useMemo } from "react"
import { ChessAssistantOverlay } from "./lib/presentation/components/Overlay"
import { ErrorBoundary } from "./lib/presentation/components/ErrorBoundary"
import { ChessComBoardAdapter } from "./lib/infrastructure/adapters/ChessComBoardAdapter"
import { ChessComMoveListAdapter } from "./lib/infrastructure/adapters/ChessComMoveListAdapter"
import { ChessComContextAdapter } from "./lib/infrastructure/adapters/ChessComContextAdapter"
import { ChromeStorageAdapter } from "./lib/infrastructure/adapters/ChromeStorageAdapter"
import { ChromeEnginePort } from "./lib/infrastructure/engine/ChromeEnginePort"
import {
  ClockStrategy,
  BoardDiffStrategy,
  PuzzleTextStrategy,
  OrientationStrategy,
  PieceCountStrategy,
} from "./lib/infrastructure/dom/DomColorStrategies"
import { DetectActiveColorUseCase } from "./lib/application/useCases/DetectActiveColorUseCase"
import { ResolvePositionUseCase } from "./lib/application/useCases/ResolvePositionUseCase"
import { AnalyzePositionUseCase } from "./lib/application/useCases/AnalyzePositionUseCase"
import { ComplianceService } from "./lib/application/services/ComplianceService"
import { AnalysisContextRegistry } from "./lib/application/services/AnalysisContextRegistry"
import { SettingsService } from "./lib/application/services/SettingsService"
import { useAnalysisOrchestrator } from "./lib/presentation/hooks/useAnalysisOrchestrator"
import { dbg } from "./lib/core/debug"

// ─── Plasmo Config ─────────────────────────────────────────────────────────

export const config: PlasmoCSConfig = {
  matches: ["https://*.chess.com/*"],
  all_frames: false,
  run_at: "document_idle",
}

export const getShadowHostId = () => "vx-host"

dbg("content", "Vortex v3.0 (Educational Chess Assistant) loaded")

// ─── App Component (Composition Root) ──────────────────────────────────────

const ChessAssistantApp = () => {
  const dependencies = useMemo(() => {
    // Layer 3: Infrastructure Adapters
    const boardReader = new ChessComBoardAdapter()
    const moveListReader = new ChessComMoveListAdapter()
    const contextProvider = new ChessComContextAdapter()
    const storagePort = new ChromeStorageAdapter()
    const enginePort = new ChromeEnginePort()
    const settingsService = new SettingsService(storagePort)

    // Domain Strategies
    const strategies = [
      new ClockStrategy(),
      new BoardDiffStrategy(),
      new PuzzleTextStrategy(),
      new OrientationStrategy(contextProvider),
      new PieceCountStrategy(),
    ]

    // Layer 2: Application Services & Use Cases
    const contextRegistry = new AnalysisContextRegistry()
    const complianceService = new ComplianceService(contextProvider)
    const colorDetector = new DetectActiveColorUseCase(strategies)
    const resolvePositionUseCase = new ResolvePositionUseCase(
      boardReader,
      moveListReader,
      contextProvider,
      colorDetector,
    )
    const analyzePositionUseCase = new AnalyzePositionUseCase(
      enginePort,
      contextRegistry,
      complianceService,
    )

    return {
      boardReader,
      moveListReader,
      contextProvider,
      enginePort,
      storagePort,
      settingsService,
      resolvePositionUseCase,
      analyzePositionUseCase,
      complianceService,
      contextRegistry,
    }
  }, [])

  const orchestrator = useAnalysisOrchestrator(dependencies)

  return (
    <ErrorBoundary>
      <ChessAssistantOverlay {...orchestrator} />
    </ErrorBoundary>
  )
}

export default ChessAssistantApp
