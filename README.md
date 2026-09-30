# Vortex — Educational Chess Position Analysis & Training Assistant

An open-source educational Chrome extension providing real-time chess position analysis and tactical training powered by **Stockfish WASM**, built with **Clean Architecture** and **React**.

---

> [!IMPORTANT]
> **Educational & Fair Play Notice:**
> This software is an open-source educational tool designed exclusively for chess study, puzzle training, tactical analysis, and post-game review. It is **NOT** intended for live rated games against human opponents. Using automated engine assistance in live matches violates the Fair Play policy of online chess platforms. The authors and contributors assume no responsibility for misuse.

> [!NOTE]
> **Non-Affiliation Notice:**
> Vortex is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Chess.com or any other chess platform.

---

## Key Features

- **Local Stockfish WASM Engine** — High-performance chess evaluation running entirely locally in your browser using WebAssembly and Chrome Manifest V3 Offscreen Documents (no external servers or cloud dependencies).
- **Clean Architecture & Hexagonal Design** — Strict separation between Domain, Application, Infrastructure, and Presentation layers adhering to SOLID principles.
- **Calibrated Human Strength Simulation** — MultiPV candidate collection combined with a calibrated **Boltzmann Softmax probability distribution** ($T = 5$ to $280$) and a **Tactical Sanity Guard** to realistically simulate play across skill tiers (~800 to 2500+ Elo).
- **Brilliant Move Detector ($!!$)** — Identifies tactical material sacrifices that lead to decisive positional advantages, including multi-ply PV sequence anticipation.
- **Human Timing Model** — Calculates natural deliberation delay recommendations based on position complexity, phase of the game, and move type.
- **Smart FEN Resolution Cascade** — Primary: incremental move-list replay via `chess.js` (accurate castling rights and en passant). Fallbacks: geometric board extraction and puzzle ply-tracking.
- **Single Page Application (SPA) Support** — Automatically handles client-side route transitions and board changes without page reloads.
- **Compact View Mode** — Minimal HUD footprint (toggleable via `Alt+V`) to keep the study workspace clean.
- **100% Test Coverage on Core Paths** — 123 automated unit and integration tests powered by Vitest and JSDOM.

---

## Tech Stack

| Component               | Technology                            | Description                                                |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **Architecture**        | Clean Architecture / Ports & Adapters | Pure Domain core with decoupled infrastructure adapters    |
| **Extension Framework** | Plasmo (Manifest V3)                  | Modern WebExtension development framework                  |
| **Chess Engine**        | Stockfish 16+ WASM                    | WebAssembly engine hosted inside an Offscreen Web Worker   |
| **UI Layer**            | React 18 + react-chessboard           | Declarative, component-driven overlay HUD                  |
| **Game Logic**          | chess.js                              | Incremental SAN replay and move legality validation        |
| **Testing**             | Vitest + JSDOM                        | Fast, modern test runner with DOM simulation               |
| **Type Safety**         | TypeScript 5                          | Strict typing across all domain and application boundaries |
| **Code Quality**        | ESLint 9 (Flat Config) + Prettier     | Automated linting, formatting, and hooks verification      |

---

## Architecture Overview

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

For full architectural documentation, design patterns, and layer breakdowns, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) $\ge$ 18.0.0
- npm $\ge$ 9.0.0

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/vortex-chess.git
cd vortex-chess
```

### 2. Install dependencies

```bash
npm install
```

### 3. Engine Binary Setup

The Stockfish WASM binary (`assets/stockfish.wasm`, ~7.3MB) is excluded from version control.
Download the precompiled binary from the [official Stockfish WASM releases](https://github.com/nicfv/Stockfish/releases) and place it in the `assets/` folder:

```bash
# Path should be:
assets/stockfish.wasm
```

---

## Development & Building

### Run Development Server

```bash
npm run dev
```

Load the unpacked extension into Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select `build/chrome-mv3-dev/`

### Production Build

```bash
npm run build
```

The production output will be generated in `build/chrome-mv3-prod/`.

---

## Automated Testing & Quality

```bash
# Run Vitest test suite (123 tests)
npm test

# Run TypeScript type check
npm run typecheck

# Check and fix linting
npm run lint
npm run lint:fix

# Format codebase
npm run format
```

---

## Strength Calibration & Boltzmann Model

To simulate human play accurately without creating bizarre blunders, Vortex runs Stockfish at full strength using expanded MultiPV (8–12 lines) and samples candidate moves using a Boltzmann Softmax distribution:

$$P(\text{move}_i) = \frac{\exp\left(-\frac{\Delta \text{cp}_i}{T}\right)}{\sum_{j} \exp\left(-\frac{\Delta \text{cp}_j}{T}\right)}$$

- **$\Delta \text{cp}_i$**: Centipawn loss compared to the top engine move.
- **$T$ (Temperature)**: Calibrated according to player tier:
  - **Beginner (~800)**: $T = 280$ (~58% accuracy)
  - **Casual (~1100)**: $T = 180$ (~68% accuracy)
  - **Intermediate (~1350)**: $T = 110$ (~78% accuracy)
  - **Club Player (~1500)**: $T = 65$ (~84% accuracy)
  - **Advanced (~1800)**: $T = 35$ (~89% accuracy)
  - **Expert (~2200)**: $T = 15$ (~94% accuracy)
  - **Master (~2500)**: $T = 5$ (>97% accuracy)
  - **Maximum**: Pure uncapped Stockfish (>99% accuracy)

A **Tactical Sanity Guard** protects against immediate checkmates and hanging high-value pieces without compensation, ensuring errors feel natural for each Elo tier.

---

## License & Credits

- Vortex codebase is licensed under the [MIT License](LICENSE).
- **Stockfish** is licensed under the [GNU General Public License v3.0 (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.en.html).
- **chess.js** is licensed under the BSD-2-Clause License by Jeff Hlywa.
