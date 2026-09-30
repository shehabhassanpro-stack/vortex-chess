/**
 * Vortex — Offscreen Document Script (v3.0)
 *
 * Runs inside assets/offscreen.html — a hidden page created by the Background
 * Service Worker. Offscreen Documents can create Web Workers (Service Workers cannot).
 *
 * Architecture:
 *   Background (Service Worker)
 *       ↕ chrome.runtime.sendMessage
 *   Offscreen Document (this file)
 *       ↕ Worker.postMessage
 *   Stockfish Web Worker (WASM)
 */

"use strict";

// ─── Global Error Handling ────────────────────────────────────────────────

window.onerror = function (message, source, lineno, colno, error) {
  console.error("[Vortex:Offscreen] Fatal error:", message, "at", source, lineno, colno, error);
  chrome.runtime.sendMessage({ type: "ENGINE_FATAL_ERROR", error: String(message) }).catch(() => {});
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Vortex:Offscreen] Unhandled promise rejection:", event.reason);
  chrome.runtime.sendMessage({ type: "ENGINE_FATAL_ERROR", error: String(event.reason) }).catch(() => {});
});

// ─── State ────────────────────────────────────────────────────────────────

let stockfishWorker    = null;
let isEngineReady      = false;
let currentAnalysisId  = 0;
let currentCorrelationId = "";
let engineState        = "idle"; // "idle" | "searching"
let pendingAnalysis    = null; // Stores the latest request waiting for bestmove
let isManuallyStopped  = false;

let retryCount = 0;
const MAX_RETRIES = 3;

// ─── Engine Capabilities (discovered from UCI response) ───────────────────

/**
 * Discovered at runtime by parsing the engine's UCI option list.
 * Defaults to zero until the UCI handshake completes.
 */
const engineCaps = {
  eloMin:              0,
  eloMax:              0,
  supportsLimitStrength: false,
};

// ─── Profile Cache ────────────────────────────────────────────────────────

/**
 * Cache key for the last applied EngineProfile.
 * Prevents re-sending identical setoption commands for every analysis request.
 * Format: "{limitStrength}:{elo}"
 */
let lastAppliedProfileKey = "";

// ─── Readyok Pipeline ─────────────────────────────────────────────────────

/**
 * Callback to invoke when the engine sends "readyok".
 * Set by applyProfileAndAnalyze(); cleared either on readyok or on timeout.
 */
let pendingReadyCallback = null;
let readyTimeoutHandle   = null;
const READY_TIMEOUT_MS   = 5000;

// ─── UCI Output Parser ────────────────────────────────────────────────────

/**
 * Parses each line of UCI output from Stockfish.
 * Handles:
 *   - Option discovery (UCI_Elo min/max)
 *   - uciok (engine ready + broadcast capabilities)
 *   - readyok (fire pending analysis callback)
 *   - All other lines (forward to Background → Content Script)
 */
function handleEngineLine(line) {
  // ── Discover UCI_Elo range ──
  if (line.startsWith("option name UCI_Elo")) {
    const minMatch = line.match(/\bmin\s+(\d+)/);
    const maxMatch = line.match(/\bmax\s+(\d+)/);
    if (minMatch && maxMatch) {
      engineCaps.eloMin               = parseInt(minMatch[1], 10);
      engineCaps.eloMax               = parseInt(maxMatch[1], 10);
      engineCaps.supportsLimitStrength = true;
      console.log(`[Vortex:Offscreen] UCI_Elo range discovered: ${engineCaps.eloMin}–${engineCaps.eloMax}`);
    }
  }

  // ── UCI handshake complete ──
  if (line.includes("uciok")) {
    console.log("[Vortex:Offscreen] Stockfish ready (uciok)");
    isEngineReady = true;
    retryCount = 0;

    // Configure engine hardware utilisation
    const threads = Math.min(4, Math.max(1, Math.floor(
      (typeof navigator !== "undefined" ? (navigator.hardwareConcurrency || 2) : 2) / 2
    )));
    const hashMB = threads > 2 ? 128 : 64;

    stockfishWorker.postMessage(`setoption name Threads value ${threads}`);
    stockfishWorker.postMessage(`setoption name Hash value ${hashMB}`);
    stockfishWorker.postMessage("isready");

    // Broadcast discovered capabilities to all chess.com tabs (via Background)
    chrome.runtime.sendMessage({
      type:               "ENGINE_CAPS",
      eloMin:             engineCaps.eloMin,
      eloMax:             engineCaps.eloMax,
      supportsLimitStrength: engineCaps.supportsLimitStrength,
    }).catch(() => {});

    // If an analysis was requested during cold-start boot, fire it immediately
    if (pendingAnalysis) {
      const { fen, profile, limits, id, correlationId } = pendingAnalysis;
      pendingAnalysis = null;
      applyProfileAndAnalyze(fen, profile, limits, id, correlationId);
    }
  }

  // ── readyok → fire pending analysis ──
  if (line.includes("readyok") && pendingReadyCallback) {
    if (readyTimeoutHandle) {
      clearTimeout(readyTimeoutHandle);
      readyTimeoutHandle = null;
    }
    const cb = pendingReadyCallback;
    pendingReadyCallback = null;
    cb();
    return; // Don't forward "readyok" to content script
  }

  // ── engine state tracking ──
  if (line.startsWith("bestmove")) {
    engineState = "idle";
    if (pendingAnalysis) {
      const { fen, profile, limits, id, correlationId } = pendingAnalysis;
      pendingAnalysis = null;
      applyProfileAndAnalyze(fen, profile, limits, id, correlationId);
      // Skip forwarding the bestmove from the cancelled search
      return; 
    }
    if (isManuallyStopped) {
      isManuallyStopped = false;
      return; // Skip forwarding bestmove from explicitly stopped search
    }
  }

  // ── Forward all other lines to Background (tagged with analysis ID) ──
  chrome.runtime.sendMessage({
    type: "ENGINE_OUTPUT",
    data: line,
    id:   currentAnalysisId,
    correlationId: currentCorrelationId,
  }).catch(() => {});
}

// ─── Stockfish Initialisation ─────────────────────────────────────────────

function initStockfish() {
  if (stockfishWorker) return;

  console.log("[Vortex:Offscreen] Creating Stockfish Worker…");
  stockfishWorker = new Worker("stockfish.js");

  stockfishWorker.onmessage = (event) => {
    const line = typeof event.data === "string" ? event.data : String(event.data);
    handleEngineLine(line);
  };

  stockfishWorker.onerror = (err) => {
    console.error("[Vortex:Offscreen] Worker error:", err.message, err);
    stockfishWorker = null;
    isEngineReady   = false;

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = retryCount * 1000;
      console.log(`[Vortex:Offscreen] Retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
      setTimeout(initStockfish, delay);
    } else {
      console.error("[Vortex:Offscreen] Engine failed after max retries — giving up");
      chrome.runtime.sendMessage({ type: "ENGINE_FATAL_ERROR" }).catch(() => {});
    }
  };

  // Begin UCI handshake — triggers handleEngineLine("option name UCI_Elo …") etc.
  stockfishWorker.postMessage("uci");
}

// ─── Profile Pipeline ─────────────────────────────────────────────────────

/**
 * Apply an EngineProfile, wait for readyok, then start analysis.
 *
 * Pipeline (fully sequential — no race conditions):
 *   stop → setoption UCI_LimitStrength [if changed] → setoption UCI_Elo [if applicable]
 *     → setoption MultiPV → isready → [wait readyok / 5s timeout] → position fen → go
 *
 * @param {string} fen            - FEN of the position to analyse
 * @param {{ elo: number, limitStrength: boolean }} profile - Engine strength profile
 * @param {{ depth?: number, movetime?: number, multipv?: number }} limits - Search limits
 * @param {number} id             - Analysis request ID (forwarded to content script)
 */
function applyProfileAndAnalyze(fen, profile, limits, id, correlationId) {
  // If engine is currently searching, we MUST stop it and wait for bestmove
  if (engineState === "searching") {
    pendingAnalysis = { fen, profile, limits, id, correlationId };
    if (stockfishWorker) stockfishWorker.postMessage("stop");
    return;
  }

  // Cancel any previous pending readyok callback (superseded by this request)
  if (pendingReadyCallback) {
    pendingReadyCallback = null;
  }
  if (readyTimeoutHandle) {
    clearTimeout(readyTimeoutHandle);
    readyTimeoutHandle = null;
  }

  // Step 1: Apply strength profile — only if it changed
  if (engineCaps.supportsLimitStrength) {
    const profileKey = `${profile.limitStrength}:${profile.elo}`;
    if (profileKey !== lastAppliedProfileKey) {
      if (profile.limitStrength && profile.elo > 0) {
        const clamped = Math.max(engineCaps.eloMin, Math.min(engineCaps.eloMax, profile.elo));
        stockfishWorker.postMessage("setoption name UCI_LimitStrength value true");
        stockfishWorker.postMessage(`setoption name UCI_Elo value ${clamped}`);
      } else {
        stockfishWorker.postMessage("setoption name UCI_LimitStrength value false");
      }
      lastAppliedProfileKey = profileKey;
    }
  }

  // Step 3: Apply MultiPV (for Weak Move Model)
  const multipv = (limits && limits.multipv) ? limits.multipv : 1;
  stockfishWorker.postMessage(`setoption name MultiPV value ${multipv}`);

  // Step 4: Update analysis ID and request readyok
  currentAnalysisId = id;
  currentCorrelationId = correlationId || ""; // We pass correlationId as 5th argument
  stockfishWorker.postMessage("isready");

  // Step 5: Schedule analysis to run AFTER readyok arrives
  pendingReadyCallback = () => {
    engineState = "searching";
    stockfishWorker.postMessage(`position fen ${fen}`);
    let goCmd = "go";
    if (limits && limits.depth) goCmd += ` depth ${limits.depth}`;
    if (limits && limits.movetime) goCmd += ` movetime ${limits.movetime}`;
    if (!limits || (!limits.depth && !limits.movetime)) goCmd += " depth 18";
    stockfishWorker.postMessage(goCmd);
  };

  // Step 6: Safety timeout — if readyok never arrives, proceed anyway
  readyTimeoutHandle = setTimeout(() => {
    if (pendingReadyCallback) {
      console.warn("[Vortex:Offscreen] readyok timeout — proceeding with analysis");
      const cb = pendingReadyCallback;
      pendingReadyCallback = null;
      cb();
    }
  }, READY_TIMEOUT_MS);
}

// ─── Message Listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return false;

  switch (message.type) {

    case "INIT":
      initStockfish();
      sendResponse({ status: "ok", isEngineReady });
      break;

    case "ANALYZE": {
      const { fen, profile, limits, id, correlationId } = message;

      if (!fen || typeof fen !== "string") {
        sendResponse({ status: "error", error: "Invalid FEN" });
        break;
      }

      const resolvedProfile = profile || { elo: 0, limitStrength: false };
      const resolvedLimits  = limits  || { depth: 18 };

      if (!isEngineReady) {
        // Engine not ready yet — queue this analysis so it fires automatically upon uciok
        pendingAnalysis = {
          fen,
          profile: resolvedProfile,
          limits: resolvedLimits,
          id: id ?? 0,
          correlationId,
        };
        initStockfish();
        sendResponse({ status: "analyzing", message: "Engine booting. Analysis queued." });
        break;
      }

      applyProfileAndAnalyze(fen, resolvedProfile, resolvedLimits, id ?? 0, correlationId);
      sendResponse({ status: "analyzing" });
      break;
    }

    case "STOP":
      if (pendingReadyCallback) {
        // Cancel any queued analysis
        pendingReadyCallback = null;
        if (readyTimeoutHandle) { clearTimeout(readyTimeoutHandle); readyTimeoutHandle = null; }
      }
      pendingAnalysis = null;
      isManuallyStopped = true;
      if (stockfishWorker && engineState === "searching") {
         stockfishWorker.postMessage("stop");
      }
      sendResponse({ status: "stopped" });
      break;

    case "GET_CAPS":
      // Content script requests capabilities on-demand (handles timing edge case)
      sendResponse({
        eloMin:              engineCaps.eloMin,
        eloMax:              engineCaps.eloMax,
        supportsLimitStrength: engineCaps.supportsLimitStrength,
      });
      break;

    case "STATUS":
      sendResponse({
        isEngineReady,
        hasWorker:          !!stockfishWorker,
        retryCount,
        currentAnalysisId,
        engineCaps,
      });
      break;

    default:
      return false;
  }

  return true;
});

// ─── Boot ──────────────────────────────────────────────────────────────────
console.log("[Vortex:Offscreen] Loaded. Booting Stockfish…");
initStockfish();
