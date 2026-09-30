# Architecture Documentation — Chess Helper AI

## Overview

Chess Helper AI is built according to **Clean Architecture** (Robert C. Martin) and **Ports & Adapters (Hexagonal Architecture)**. The codebase is organized into four distinct concentric layers with strict unidirectional dependency rules:

```
+-------------------------------------------------------------+
| Presentation Layer (React components, hooks, popup)         |
|   +-------------------------------------------------------+ |
|   | Application Layer (Use cases, orchestrators, services)| |
|   |   +-------------------------------------------------+ | |
|   |   | Infrastructure Layer (Adapters, DOM, Ports)     | | |
|   |   |   +-------------------------------------------+ | | |
|   |   |   | Domain Layer (Entities, Services, Ports)  | | | |
|   |   |   +-------------------------------------------+ | | |
|   |   +-------------------------------------------------+ | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

## The Four Layers

### 1. Domain Layer (`lib/domain/`)

The innermost core of the application. It contains pure business entities, value objects, domain services, and abstract port interfaces.

- **Rule:** Contains **NO** external dependencies (no Chrome APIs, no DOM manipulation, no React).
- **Subdirectories:**
  - `ports/`: Abstract interfaces defining external dependencies (`IBoardReader`, `IMoveListReader`, `IColorDetectionStrategy`, `IGameContextProvider`, `IEnginePort`, `IStoragePort`).
  - `entities/`: Domain value objects and models (`ChessPosition`, `EngineConfig`, `AnalysisResult`).
  - `services/`: Pure computational functions and domain logic (`FenBuilder`, `BoardEncoder`, `SanNormalizer`, `MoveReplayer`).
  - `types.ts`: Domain types (`BoardArray`, `ActiveColor`, `TurnResult`, `PositionSource`, `SpeedMode`, etc.).

### 2. Infrastructure Layer (`lib/infrastructure/`)

Contains concrete adapter implementations of the Domain ports.

- **Rule:** Implements ports defined in the domain layer. Adapters wrap external environments (DOM, Chrome Storage, Web Worker / UCI).
- **Subdirectories:**
  - `adapters/`: Concrete adapters (`ChessComBoardAdapter`, `ChessComMoveListAdapter`, `ChessComContextAdapter`, `ChromeStorageAdapter`).
  - `dom/`: CSS selectors registry (`selectors.ts`) and DOM-specific active color strategies (`DomColorStrategies.ts`).
  - `engine/`: UCI engine communications (`ChromeEnginePort.ts`) and output parsing (`EngineMessageParser.ts`).

### 3. Application Layer (`lib/application/`)

Orchestrates application use cases and business flows. Uses Domain entities and communicates with external infrastructure only via Domain port interfaces (Dependency Inversion Principle).

- **Use Cases & Services:**
  - `ResolvePositionUseCase`: Cascading resolution of FEN (Movelist replay -> Puzzle cues -> Geometric fallback).
  - `DetectActiveColorUseCase`: Chain of Responsibility across prioritized color strategies.
  - `AnalyzePositionUseCase`: Engine analysis lifecycle, profile application, and compliance checking.
  - `TrackGameUseCase`: Manages move list synchronisation and game validation.
  - `ComplianceService`: Evaluates Fair Play compliance rules based on game context.
  - `AnalysisContextRegistry`: In-memory correlation ID context registry with TTL pruning.

### 4. Presentation Layer (`lib/presentation/` & UI roots)

Contains lightweight React components, state hooks, and UI presentation logic.

- **Hooks:**
  - `useAnalysisOrchestrator`: Top-level orchestrator connecting use cases to React state.
  - `useBoardObserver`: Observes DOM mutations with debouncing.
  - `useEngineMessages`: Subscribes to engine port output.
  - `useSpaNavigation`: Detects URL/route changes on single-page chess apps.
- **Components (`lib/presentation/components/Overlay/`):**
  - `EngineMetrics.tsx`: Evaluation, depth, and status display.
  - `StrengthSelector.tsx`: Stockfish strength & Boltzmann temperature presets.
  - `SpeedSelector.tsx`: Search speed/depth dropdown.
  - `BoardPreview.tsx`: Live chessboard preview with custom best-move arrows.
  - `FairPlayBanner.tsx`: Live game policy warning banner.
  - `StandbyPanel.tsx`: Standby and Force Start button.
  - `EngineErrorPanel.tsx`: Engine crash alert.
  - `index.tsx`: Clean parent overlay container.
  - `ErrorBoundary.tsx`: React error boundary for fault tolerance.

---

## Composition Root (`content.tsx`)

`content.tsx` acts solely as the **Composition Root**. It instantiates the concrete adapters, use cases, and services, wires them into `useAnalysisOrchestrator`, and renders the UI inside an `<ErrorBoundary>`. It is strictly under 85 lines of code.

---

## SOLID Principles Summary

- **Single Responsibility Principle (SRP):** Every file and class has exactly one reason to change. FEN generation, color detection, engine communication, DOM parsing, and UI rendering are completely isolated.
- **Open/Closed Principle (OCP):** New color detection strategies or board formats can be added by implementing `IColorDetectionStrategy` or `IBoardReader` without altering existing resolution logic.
- **Liskov Substitution Principle (LSP):** Any adapter implementing `IBoardReader` or `IMoveListReader` can be swapped seamlessly in use cases.
- **Interface Segregation Principle (ISP):** Component props and port interfaces are granular and decoupled into focused sub-interfaces.
- **Dependency Inversion Principle (DIP):** High-level application use cases depend exclusively on abstract domain interfaces (`IBoardReader`, `IEnginePort`), never on concrete browser or DOM classes.
