/**
 * Vortex — Background Service Worker (v3.0)
 *
 * Responsibilities:
 *   1. Manage the Offscreen Document lifecycle
 *   2. Route messages between content scripts and the offscreen document
 *   3. Send ENGINE_OUTPUT only to the tab that requested the analysis
 *   4. Broadcast ENGINE_CAPS once to all chess.com tabs
 *   5. Handle GET_CAPS request-on-demand for late-loading content scripts
 *
 * Message flow:
 *   Content Script ─ANALYZE──► Background ─ANALYZE──► Offscreen ─UCI──► Stockfish
 *   Content Script ◄──bestmove─ Background ◄─ENGINE_OUTPUT─ Offscreen ◄──UCI── Stockfish
 *
 * Security:
 *   All incoming messages are validated against expected sender origin.
 */

import type { AnalyzeMessage, EngineOutputMessage, EngineCapsMessage } from "~lib/core/types"

// ─── Offscreen Document Lifecycle ─────────────────────────────────────────

const OFFSCREEN_URL = "assets/offscreen.html"

let offscreenCreating = false

async function ensureOffscreen(): Promise<void> {
  if ("getContexts" in chrome.runtime) {
    const contexts = await (
      chrome.runtime as typeof chrome.runtime & {
        getContexts: (filter: object) => Promise<object[]>
      }
    ).getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
    })
    if (contexts.length > 0) return
  }

  if (offscreenCreating) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!offscreenCreating) {
          clearInterval(check)
          resolve()
        }
      }, 50)
    })
    return
  }

  offscreenCreating = true
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["WORKERS" as chrome.offscreen.Reason],
      justification: "Runs the Stockfish WASM chess engine inside a Web Worker.",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes("single")) {
      console.error("[Vortex:BG] Failed to create offscreen document:", err)
      throw err
    }
  } finally {
    offscreenCreating = false
  }
}

// ─── Source Validation ─────────────────────────────────────────────────────

function validateSender(
  sender: chrome.runtime.MessageSender,
  expectedOrigin: "content" | "offscreen",
): boolean {
  if (sender.id !== chrome.runtime.id) return false
  if (expectedOrigin === "content") return !!sender.tab
  if (expectedOrigin === "offscreen") return !sender.tab
  return false
}

// ─── Tab Tracking — Single Active Analysis ─────────────────────────────────

/**
 * Only one Stockfish instance runs at a time (single Offscreen document).
 * Track which tab made the most recent ANALYZE request — that tab gets
 * the ENGINE_OUTPUT responses.
 */
let currentAnalysisOwner: { tabId: number; correlationId: string } | null = null

// ─── Message Router ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ── ENGINE_OUTPUT from offscreen → targeted tab only ──
  if (request.type === "ENGINE_OUTPUT") {
    if (!validateSender(sender, "offscreen")) {
      console.warn("[Vortex:BG] Rejected ENGINE_OUTPUT from unexpected sender")
      return false
    }

    const msg = request as EngineOutputMessage
    if (currentAnalysisOwner && msg.correlationId === currentAnalysisOwner.correlationId) {
      chrome.tabs
        .sendMessage(currentAnalysisOwner.tabId, {
          type: "ENGINE_OUTPUT",
          data: msg.data,
          id: msg.id,
          correlationId: msg.correlationId,
        })
        .catch(() => {
          // Tab may have been closed — safe to ignore
        })
    }
    return false
  }

  // ── ENGINE_FATAL_ERROR from offscreen → forward to current tab owner ──
  if (request.type === "ENGINE_FATAL_ERROR") {
    if (!validateSender(sender, "offscreen")) return false

    if (currentAnalysisOwner?.tabId) {
      chrome.tabs
        .sendMessage(currentAnalysisOwner.tabId, {
          type: "ENGINE_FATAL_ERROR",
          error: request.error || "Engine crashed unexpectedly",
        })
        .catch(() => {})
    }
    currentAnalysisOwner = null
    return false
  }

  // ── ENGINE_CAPS from offscreen → broadcast to all chess.com tabs ──
  if (request.type === "ENGINE_CAPS") {
    if (!validateSender(sender, "offscreen")) return false

    const caps = request as EngineCapsMessage
    chrome.tabs.query({ url: "https://*.chess.com/*" }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) chrome.tabs.sendMessage(tab.id, caps).catch(() => {})
      }
    })
    return false
  }

  // ── Messages from content scripts ──
  switch (request.type) {
    case "INIT_ENGINE":
      if (!validateSender(sender, "content")) {
        sendResponse({ status: "error", error: "Unauthorized" })
        return true
      }
      ensureOffscreen()
        .then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "INIT" }))
        .then((res) => sendResponse({ status: "ok", ...res }))
        .catch((err) => sendResponse({ status: "error", error: String(err) }))
      return true

    case "ANALYZE": {
      if (!validateSender(sender, "content")) {
        sendResponse({ status: "error", error: "Unauthorized" })
        return true
      }

      const { fen, id, correlationId, profile, limits } = request as AnalyzeMessage

      if (!fen || typeof fen !== "string" || !fen.includes("/")) {
        sendResponse({ status: "error", error: "Invalid FEN string" })
        return true
      }

      // Track which tab owns this analysis
      if (sender.tab?.id) {
        currentAnalysisOwner = { tabId: sender.tab.id, correlationId }
      }

      ensureOffscreen()
        .then(() =>
          chrome.runtime.sendMessage({
            target: "offscreen",
            type: "ANALYZE",
            fen,
            id,
            correlationId,
            profile,
            limits,
          }),
        )
        .then(() => sendResponse({ status: "analyzing" }))
        .catch((err) => sendResponse({ status: "error", error: String(err) }))
      return true
    }

    case "STOP":
      // If stopped from popup/extension (no sender.tab), stop unconditionally
      if (!sender.tab) {
        chrome.runtime.sendMessage({ target: "offscreen", type: "STOP" }).catch(() => {})
        currentAnalysisOwner = null
        sendResponse({ status: "stopped" })
        return true
      }
      // Only the current owner tab can stop the engine to prevent multi-tab conflicts
      if (currentAnalysisOwner && sender.tab.id !== currentAnalysisOwner.tabId) {
        sendResponse({ status: "ignored", reason: "not_owner" })
        return true
      }
      chrome.runtime.sendMessage({ target: "offscreen", type: "STOP" }).catch(() => {})
      sendResponse({ status: "stopped" })
      return true

    // ── GET_CAPS: content script requests engine capabilities on-demand ──
    case "GET_CAPS":
      ensureOffscreen()
        .then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "GET_CAPS" }))
        .then((res) => sendResponse(res))
        .catch(() => sendResponse({ eloMin: 0, eloMax: 0, supportsLimitStrength: false }))
      return true

    case "DEBUG_STATUS":
      ensureOffscreen()
        .then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "STATUS" }))
        .then((res) => sendResponse({ offscreenCreated: true, ...res }))
        .catch(() =>
          sendResponse({ offscreenCreated: false, isEngineReady: false, hasWorker: false }),
        )
      return true

    default:
      return false
  }
})

console.log("[Vortex:BG] Background service worker loaded.")
