import { useState, useRef, useCallback, useEffect } from "react"
import type { IBoardReader } from "../../domain/ports/IBoardReader"
import type { IMoveListReader } from "../../domain/ports/IMoveListReader"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { IEnginePort, EngineCaps, EngineOutputPayload } from "../../domain/ports/IEnginePort"
import type { IStoragePort } from "../../domain/ports/IStoragePort"
import type {
  SpeedMode,
  ActiveColor,
  EngineProfile,
  SearchLimits,
  BrilliantResult,
  TimingRecommendation,
} from "../../domain/types"
import type { StrengthPreset } from "../../engine/engineStrength"
import {
  VORTEX_PRESETS,
  buildAvailablePresets,
  buildProfile,
  buildSearchLimits,
} from "../../engine/engineStrength"
import { MultiPVCollector, Mulberry32 } from "../../engine/weakMoveModel"
import { SmartMoveSelector } from "../../domain/services/SmartMoveSelector"
import { BrilliantDetector } from "../../domain/services/BrilliantDetector"
import { HumanTimingModel } from "../../domain/services/HumanTimingModel"
import { parseEngineInfo } from "../../infrastructure/engine/EngineMessageParser"
import { EngineConfig } from "../../domain/entities/EngineConfig"
import { ResolvePositionUseCase } from "../../application/useCases/ResolvePositionUseCase"
import { AnalyzePositionUseCase } from "../../application/useCases/AnalyzePositionUseCase"
import { ComplianceService } from "../../application/services/ComplianceService"
import { AnalysisContextRegistry } from "../../application/services/AnalysisContextRegistry"
import { SettingsService } from "../../application/services/SettingsService"
import { GameTracker } from "../../tracker/gameTracker"
import type { PuzzleState } from "../../board/activeColorDetector"
import { generateUUID } from "../../core/utils"
import { dbg, isDebug } from "../../core/debug"

import { useEngineMessages } from "./useEngineMessages"
import { useBoardObserver } from "./useBoardObserver"
import { useSpaNavigation } from "./useSpaNavigation"

export interface OrchestratorDependencies {
  boardReader: IBoardReader
  moveListReader: IMoveListReader
  contextProvider: IGameContextProvider
  enginePort: IEnginePort
  storagePort: IStoragePort
  settingsService: SettingsService
  resolvePositionUseCase: ResolvePositionUseCase
  analyzePositionUseCase: AnalyzePositionUseCase
  complianceService: ComplianceService
  contextRegistry: AnalysisContextRegistry
}

export function useAnalysisOrchestrator({
  boardReader,
  moveListReader,
  contextProvider,
  enginePort,
  storagePort,
  settingsService,
  resolvePositionUseCase,
  analyzePositionUseCase,
  complianceService,
  contextRegistry: _contextRegistry,
}: OrchestratorDependencies) {
  // ── State ──
  const [bestMove, setBestMove] = useState("")
  const [evaluation, setEvaluation] = useState("")
  const [depth, setDepth] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [currentFen, setCurrentFen] = useState("start")
  const [isActive, setIsActive] = useState(false)
  const [standby, setStandby] = useState(false)
  const [isForced, setIsForced] = useState(false)
  const [fenSource, setFenSource] = useState<"chess.js" | "geometric-fallback" | "">("")
  const [speedMode, setSpeedModeState] = useState<SpeedMode>("fast")
  const [complianceBlocked, setComplianceBlocked] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [availablePresets, setAvailablePresets] = useState<StrengthPreset[]>(VORTEX_PRESETS)
  const [selectedPreset, setSelectedPresetState] = useState<StrengthPreset | null>(
    () => VORTEX_PRESETS.find((p) => p.id === "club") || VORTEX_PRESETS[0],
  )
  const [brilliantEnabled, setBrilliantEnabledState] = useState(true)
  const [compactMode, setCompactModeState] = useState(false)
  const [brilliantResult, setBrilliantResult] = useState<BrilliantResult | null>(null)
  const [timingGuidance, setTimingGuidance] = useState<TimingRecommendation | null>(null)

  // ── Refs ──
  const lastFenRef = useRef("")
  const currentFenRef = useRef("start")
  const correlationIdRef = useRef("")
  const sessionIdRef = useRef(generateUUID())
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gameTrackerRef = useRef(
    new GameTracker({
      onWarning: (msg) => dbg("GameTracker", msg),
      moveListReader,
    }),
  )
  const prevBoardSigRef = useRef("")
  const prevGeoTurnRef = useRef<ActiveColor | "unknown">("unknown")
  const traceMetaRef = useRef({ src: "", plies: 0, lastSan: "", turnSrc: "" })
  const puzzleStateRef = useRef<PuzzleState>({ baseTurn: null, basePlies: -1, settled: false })

  const multiPVCollectorRef = useRef(new MultiPVCollector())
  const rngRef = useRef(new Mulberry32(Date.now()))

  // ── Watchdog Helpers ──
  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current)
      watchdogTimerRef.current = null
    }
  }, [])

  const armWatchdog = useCallback(
    (timeoutMs: number) => {
      clearWatchdog()
      watchdogTimerRef.current = setTimeout(() => {
        dbg(
          "Vortex",
          `[Watchdog] Analysis timed out after ${timeoutMs}ms. Gracefully resetting thinking state.`,
        )
        setThinking(false)
      }, timeoutMs)
    },
    [clearWatchdog],
  )

  // ── Settings Persistence Handlers ──
  const setSpeedMode = useCallback(
    (mode: SpeedMode) => {
      setSpeedModeState(mode)
      settingsService.saveSetting("speedMode", mode).catch(() => {})
    },
    [settingsService],
  )

  const setSelectedPreset = useCallback(
    (preset: StrengthPreset) => {
      setSelectedPresetState(preset)
      settingsService.saveSetting("presetId", preset.id).catch(() => {})
    },
    [settingsService],
  )

  const setBrilliantEnabled = useCallback(
    (enabled: boolean) => {
      setBrilliantEnabledState(enabled)
      settingsService.saveSetting("brilliantEnabled", enabled).catch(() => {})
    },
    [settingsService],
  )

  const setCompactMode = useCallback(
    (compact: boolean) => {
      setCompactModeState(compact)
      settingsService.saveSetting("compactMode", compact).catch(() => {})
    },
    [settingsService],
  )

  // ── Keyboard shortcut for Compact View (Alt+V / Alt+X) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTargetKey =
        e.code === "KeyV" ||
        e.code === "KeyX" ||
        e.key?.toLowerCase() === "v" ||
        e.key?.toLowerCase() === "x" ||
        e.key === "ر" ||
        e.key === "ء"

      if (e.altKey && isTargetKey) {
        e.preventDefault()
        e.stopPropagation()
        setCompactModeState((prev) => {
          const next = !prev
          settingsService.saveSetting("compactMode", next).catch(() => {})
          return next
        })
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [settingsService])

  const resetAnalysis = useCallback(() => {
    setBestMove("")
    setEvaluation("")
    setDepth(0)
    setThinking(true)
    setEngineError(null)
    setBrilliantResult(null)
  }, [])

  // ── Engine Message Handlers ──
  const handleEngineOutput = useCallback(
    (msg: EngineOutputPayload) => {
      const line = msg.data

      multiPVCollectorRef.current.feedLine(line)

      const parsed = parseEngineInfo(line)
      if (parsed.depth !== null) setDepth(parsed.depth)
      if (parsed.formattedScore !== null) setEvaluation(parsed.formattedScore)

      if (line.startsWith("bestmove")) {
        clearWatchdog()

        const parts = line.split(/\s+/)
        let finalMove = parts[1] && parts[1] !== "(none)" ? parts[1] : ""
        const candidates = multiPVCollectorRef.current.harvest()

        if (candidates.length > 0 && finalMove) {
          const currentBoardFen = currentFenRef.current

          try {
            // 1. Evaluate for Brilliant Move
            const brilliant = BrilliantDetector.detect(candidates, currentBoardFen)
            setBrilliantResult(brilliant)

            // 2. Select Move: If brilliant and Brilliant Seeker is enabled, play brilliant
            if (brilliant.isBrilliant && brilliantEnabled) {
              finalMove = brilliant.move
              dbg(
                "Vortex",
                `[BrilliantEngine] Brilliant move locked: ${finalMove} (${brilliant.reason})`,
              )
            } else if (selectedPreset?.mode === "maximum") {
              finalMove = candidates[0].move
              const s = (candidates[0].scoreCp / 100).toFixed(2)
              setEvaluation(candidates[0].scoreCp >= 0 ? `+${s}` : s)
              dbg("Vortex", `[MaximumEngine] Direct top move locked: ${finalMove}`)
            } else {
              // Apply Boltzmann Softmax SmartMoveSelector
              const tierId = selectedPreset?.id || "club"
              const temperature = selectedPreset?.weakConfig?.temperature ?? 65
              const elo = selectedPreset?.elo || 1500

              const selected = SmartMoveSelector.select(
                candidates,
                {
                  tierId,
                  temperature,
                  elo,
                  fen: currentBoardFen,
                  rng: rngRef.current,
                },
                currentBoardFen,
                rngRef.current,
              )
              finalMove = selected.move
              const s = (selected.scoreCp / 100).toFixed(2)
              setEvaluation(selected.scoreCp >= 0 ? `+${s}` : s)
              dbg(
                "Vortex",
                `[SmartMoveSelector] Selected move=${finalMove} for tier=${tierId} (T=${temperature}, Elo=${elo}) from ${candidates.length} candidates`,
              )
            }

            // 3. Compute Timing Guidance
            const timing = HumanTimingModel.calculateDelay(currentBoardFen)
            setTimingGuidance(timing)
          } catch (evalErr) {
            dbg("Vortex", `[MoveEvalError] Failed smart move calculation: ${evalErr}`)
          }
        } else {
          multiPVCollectorRef.current.reset()
        }

        const isLive = contextProvider.getContext() === "live"
        const jitterMs = isLive ? Math.floor(Math.random() * 300) + 80 : 0

        setTimeout(() => {
          if (correlationIdRef.current !== msg.correlationId) return
          setBestMove(finalMove)
          setThinking(false)
        }, jitterMs)
      }
    },
    [selectedPreset, brilliantEnabled, contextProvider, clearWatchdog],
  )

  const handleEngineCaps = useCallback(
    (caps: EngineCaps) => {
      const presets = buildAvailablePresets(caps.eloMin, caps.eloMax)
      setAvailablePresets(presets)
      // If no preset selected yet, try to load from storage or default to Club
      settingsService.loadSettings().then((saved) => {
        setSelectedPresetState((curr) => {
          if (curr) return curr
          const match = presets.find((p) => p.id === saved.presetId)
          return match || presets.find((p) => p.id === "club") || presets[0]
        })
      })
    },
    [settingsService],
  )

  const handleEngineFatalError = useCallback(
    (error: string) => {
      clearWatchdog()
      setEngineError(error)
      setThinking(false)
    },
    [clearWatchdog],
  )

  useEngineMessages({
    enginePort,
    onOutput: handleEngineOutput,
    onCaps: handleEngineCaps,
    onFatalError: handleEngineFatalError,
  })

  // ── Trigger Analysis ──
  const triggerAnalysis = useCallback(
    (options?: { ignoreFen?: boolean; forceAnalysis?: boolean }) => {
      const force = options?.forceAnalysis || false
      const ignoreFen = options?.ignoreFen || false

      if (!isActive) return
      if (force) setIsForced(true)

      const compliance = complianceService.check(force || isForced)
      if (compliance.blocked) {
        clearWatchdog()
        setComplianceBlocked(true)
        setStandby(true)
        setThinking(false)
        setBestMove("")
        return
      }
      setComplianceBlocked(false)

      const hasGame = force || isForced || moveListReader.findContainer() !== null
      if (!hasGame) {
        clearWatchdog()
        setStandby(true)
        setThinking(false)
        setBestMove("")
        return
      }
      setStandby(false)

      const res = resolvePositionUseCase.execute(
        gameTrackerRef.current,
        puzzleStateRef.current,
        prevBoardSigRef.current,
        prevGeoTurnRef.current,
      )

      prevBoardSigRef.current = res.newBoardSig
      prevGeoTurnRef.current = res.newGeoTurn
      traceMetaRef.current = res.traceMeta

      if (!res.position) return

      const fen = res.position.fen
      if (fen === lastFenRef.current && !ignoreFen) {
        if (isDebug()) {
          const { src, plies, lastSan, turnSrc } = traceMetaRef.current
          dbg(
            "Vortex",
            `[TRACE-SKIP] reason=unchanged-fen src=${src} plies=${plies} lastSan=${lastSan} turnSrc=${turnSrc}`,
          )
        }
        return
      }

      lastFenRef.current = fen
      currentFenRef.current = fen
      setCurrentFen(fen)
      resetAnalysis()
      setFenSource(res.position.source === "chess.js" ? "chess.js" : "geometric-fallback")

      multiPVCollectorRef.current.reset()

      const correlationId = generateUUID()
      correlationIdRef.current = correlationId

      const preset = selectedPreset
      const profile: EngineProfile = preset
        ? buildProfile(preset)
        : { elo: 0, limitStrength: false }
      const limits: SearchLimits = buildSearchLimits(speedMode, preset ?? undefined)

      const config = EngineConfig.create(profile, limits, correlationId, sessionIdRef.current)

      if (isDebug()) {
        const { src, plies, lastSan, turnSrc } = traceMetaRef.current
        const turn = fen.split(" ")[1]
        const fenHead = fen.split(" ")[0] + " " + turn
        dbg(
          "Vortex",
          `[TRACE] src=${src} plies=${plies} lastSan=${lastSan} turn=${turn} turnSrc=${turnSrc} fen=${fenHead} corrId=${correlationId}`,
        )
      }

      // Arm watchdog circuit breaker (movetime + 2500ms, min 4s)
      const timeoutMs = Math.max(4000, (limits.movetime || 1200) + 2500)
      armWatchdog(timeoutMs)

      analyzePositionUseCase
        .execute(res.position, config, force || isForced, speedMode, preset)
        .catch((err) => {
          dbg("Vortex", `[AnalyzeError] Engine analysis dispatch failed: ${err}`)
          clearWatchdog()
          setThinking(false)
        })
    },
    [
      isActive,
      isForced,
      complianceService,
      moveListReader,
      resolvePositionUseCase,
      resetAnalysis,
      selectedPreset,
      speedMode,
      analyzePositionUseCase,
      armWatchdog,
      clearWatchdog,
    ],
  )

  // ── Start / Stop Analysis ──
  const startAnalysis = useCallback(() => {
    setIsActive(true)
    enginePort.initialize().catch(() => {})
    enginePort.getCaps().then((caps) => {
      const presets = buildAvailablePresets(caps.eloMin, caps.eloMax)
      setAvailablePresets(presets)
      settingsService.loadSettings().then((saved) => {
        setSpeedModeState(saved.speedMode)
        setBrilliantEnabledState(saved.brilliantEnabled)
        setCompactModeState(saved.compactMode)
        setSelectedPresetState((curr) => {
          if (curr) return curr
          const match = presets.find((p) => p.id === saved.presetId)
          return match || presets.find((p) => p.id === "club") || presets[0]
        })
      })
    })
  }, [enginePort, settingsService])

  const stopAnalysis = useCallback(() => {
    clearWatchdog()
    setIsActive(false)
    setThinking(false)
    setBestMove("")
    setEvaluation("")
    setDepth(0)
    setBrilliantResult(null)
    lastFenRef.current = ""
    correlationIdRef.current = ""
    analyzePositionUseCase.stop()
  }, [analyzePositionUseCase, clearWatchdog])

  // ── SPA Navigation ──
  const handleNavigation = useCallback(() => {
    clearWatchdog()
    dbg("Vortex", `[SPA-NAV] Resetting tracker state for: ${window.location.pathname}`)
    gameTrackerRef.current.reset()
    puzzleStateRef.current = { baseTurn: null, basePlies: -1, settled: false }
    lastFenRef.current = ""
    prevBoardSigRef.current = ""
    prevGeoTurnRef.current = "unknown"
    setBestMove("")
    setEvaluation("")
    setDepth(0)
    setThinking(false)
    setStandby(false)
    setIsForced(false)
    setComplianceBlocked(false)
    setBrilliantResult(null)
  }, [clearWatchdog])

  useSpaNavigation({ isActive, onNavigate: handleNavigation })

  // ── Board Observer ──
  const { isFlipped } = useBoardObserver({
    isActive,
    boardReader,
    contextProvider,
    moveListReader,
    puzzleState: puzzleStateRef.current,
    onBoardChange: () => triggerAnalysis(),
  })

  // ── Storage Sync with Popup & Initial Settings Load ──
  useEffect(() => {
    // Initial settings load
    settingsService.loadSettings().then((saved) => {
      setSpeedModeState(saved.speedMode)
      setBrilliantEnabledState(saved.brilliantEnabled)
      setCompactModeState(saved.compactMode)
    })

    storagePort.get<boolean>("analysisEnabled").then((enabled) => {
      if (enabled === false) {
        stopAnalysis()
      }
    })

    const unsubscribe = storagePort.onChanged("analysisEnabled", (newValue) => {
      if (newValue === false) {
        stopAnalysis()
      } else if (newValue === true) {
        startAnalysis()
      }
    })

    return () => {
      clearWatchdog()
      unsubscribe()
    }
  }, [storagePort, settingsService, startAnalysis, stopAnalysis, clearWatchdog])

  // ── Auto-start on load if enabled ──
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    storagePort.get<boolean>("analysisEnabled").then((enabled) => {
      if (enabled !== false) {
        t = setTimeout(startAnalysis, 1500)
      }
    })
    return () => {
      if (t) clearTimeout(t)
    }
  }, [storagePort, startAnalysis])

  return {
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
    engineError,
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
    gameContext: contextProvider.getContext(),
  }
}
