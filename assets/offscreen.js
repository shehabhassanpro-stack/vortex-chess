/**
 * Chess Helper AI — Offscreen Document Script
 *
 * This script runs inside assets/offscreen.html, which is a hidden
 * page created by the Background Service Worker via chrome.offscreen API.
 *
 * Why here? Chrome MV3 Service Workers cannot create Web Workers.
 * Offscreen Documents are full page contexts — they CAN create Web Workers.
 *
 * Architecture:
 *   Background (Service Worker)
 *       ↕ chrome.runtime.sendMessage
 *   Offscreen Document (this file) ← we are here
 *       ↕ Worker.postMessage
 *   Stockfish Web Worker (WASM)
 *
 * Sprint 1 — Task 2:
 *   Added currentAnalysisId to tag every ENGINE_OUTPUT with the
 *   ID of the analysis request that produced it. The content script
 *   discards any response whose ID is older than the latest request.
 */

"use strict";

// ─── State ───────────────────────────────────────────────────────────
let stockfishWorker = null;
let isEngineReady = false;

/** Analysis request ID — forwarded to background with every ENGINE_OUTPUT */
let currentAnalysisId = 0;

/** Commands queued before engine is ready */
const commandQueue = [];
const MAX_QUEUE_SIZE = 20;

/** Retry counters for engine crash recovery */
let retryCount = 0;
const MAX_RETRIES = 3;

// ─── Stockfish Initialisation ─────────────────────────────────────────

function initStockfish() {
  if (stockfishWorker) return;

  console.log("[ChessHelper:Offscreen] Creating Stockfish Worker…");

  stockfishWorker = new Worker("stockfish.js");

  stockfishWorker.onmessage = (event) => {
    const line = typeof event.data === "string" ? event.data : String(event.data);

    // ── Engine ready ──
    if (line.includes("uciok")) {
      console.log("[ChessHelper:Offscreen] Stockfish ready (uciok)");
      isEngineReady = true;
      retryCount = 0;  // Reset on successful init

      // Configure engine — dynamic thread count for better performance
      const threads = Math.min(4, Math.max(1, Math.floor(
        (typeof navigator !== "undefined" ? (navigator.hardwareConcurrency || 2) : 2) / 2
      )));
      const hashMB = threads > 2 ? 128 : 64;

      stockfishWorker.postMessage(`setoption name Threads value ${threads}`);
      stockfishWorker.postMessage(`setoption name MultiPV value 1`);
      stockfishWorker.postMessage(`setoption name Hash value ${hashMB}`);
      stockfishWorker.postMessage("isready");

      // Flush queued commands
      while (commandQueue.length > 0) {
        stockfishWorker.postMessage(commandQueue.shift());
      }
    }

    // ── Forward all output to Background, tagged with current analysis ID ──
    chrome.runtime.sendMessage({
      type: "ENGINE_OUTPUT",
      data: line,
      id:   currentAnalysisId,  // ← Sprint 1 Task 2: attach request ID
    }).catch(() => {
      // Background may not be listening yet after SW restart — safe to ignore
    });
  };

  stockfishWorker.onerror = (err) => {
    console.error("[ChessHelper:Offscreen] Worker error:", err.message, err);
    stockfishWorker = null;
    isEngineReady = false;

    // Exponential back-off retry
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = retryCount * 1000;
      console.log(`[ChessHelper:Offscreen] Retrying engine in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
      setTimeout(initStockfish, delay);
    } else {
      console.error("[ChessHelper:Offscreen] Engine failed after max retries — giving up");
      chrome.runtime.sendMessage({ type: "ENGINE_FATAL_ERROR" }).catch(() => {});
    }
  };

  // Begin UCI handshake
  stockfishWorker.postMessage("uci");
}

// ─── Engine Command Helpers ──────────────────────────────────────────

function sendToEngine(command) {
  if (!stockfishWorker) {
    if (commandQueue.length < MAX_QUEUE_SIZE) commandQueue.push(command);
    initStockfish();
    return;
  }
  if (!isEngineReady) {
    if (commandQueue.length < MAX_QUEUE_SIZE) commandQueue.push(command);
    return;
  }
  stockfishWorker.postMessage(command);
}

/**
 * Analyse a position.
 *
 * @param {string} fen      - FEN string of the current position
 * @param {number} depth    - Search depth (ignored when movetime is set)
 * @param {number|undefined} movetime - Time limit in ms (takes priority over depth)
 */
function analysePosition(fen, depth, movetime) {
  // Stop previous search before starting a new one
  sendToEngine("stop");
  sendToEngine(`position fen ${fen}`);

  if (movetime) {
    sendToEngine(`go movetime ${movetime}`);
  } else {
    sendToEngine(`go depth ${depth}`);
  }
}

// ─── Message Listener ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return false;

  switch (message.type) {

    case "INIT":
      initStockfish();
      sendResponse({ status: "ok", isEngineReady });
      break;

    case "ANALYZE": {
      const fen      = message.fen;
      const depth    = message.depth || 18;
      const movetime = message.movetime;
      const id       = message.id ?? 0;

      if (!fen || typeof fen !== "string") {
        sendResponse({ status: "error", error: "Invalid FEN" });
        break;
      }

      // ← Sprint 1 Task 2: update current analysis ID
      currentAnalysisId = id;

      // Send ucinewgame only when starting (fen is startpos or id is 1)
      // We rely on "stop" + "position fen" for incremental updates
      // to preserve hash table entries across moves of the same game.
      analysePosition(fen, depth, movetime);
      sendResponse({ status: "analyzing" });
      break;
    }

    case "STOP":
      if (stockfishWorker) stockfishWorker.postMessage("stop");
      sendResponse({ status: "stopped" });
      break;

    case "STATUS":
      sendResponse({
        isEngineReady,
        hasWorker:   !!stockfishWorker,
        queueLength: commandQueue.length,
        retryCount,
        currentAnalysisId,
      });
      break;

    default:
      return false;
  }

  return true;
});

// ─── Boot ──────────────────────────────────────────────────────────────
console.log("[ChessHelper:Offscreen] Loaded. Booting Stockfish…");
initStockfish();
