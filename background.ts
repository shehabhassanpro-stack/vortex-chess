/**
 * Chess Helper AI — Background Service Worker
 *
 * Responsibilities (Service Worker scope — no Web Workers allowed here):
 *   1. Manage the Offscreen Document lifecycle
 *   2. Route messages between content scripts and the offscreen document
 *   3. Broadcast engine output to chess tabs
 *
 * Message flow:
 *   Content Script  ─ANALYZE──►  Background  ─ANALYZE──►  Offscreen  ─UCI──►  Stockfish
 *   Content Script  ◄──bestmove─  Background  ◄─ENGINE_OUTPUT─  Offscreen  ◄──UCI──  Stockfish
 *
 * Sprint 1 — Task 2:
 *   Analysis request IDs are now threaded through the entire pipeline.
 *   Every ENGINE_OUTPUT message carries the id of the analysis that
 *   produced it; the content script discards stale IDs.
 *
 * Sprint 1 — Security:
 *   All incoming messages are validated against expected sender origin.
 */

// ─── Types ────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  type: "ANALYZE"
  fen: string
  id: number
  depth?: number
  movetime?: number
}

interface EngineOutputMessage {
  type: "ENGINE_OUTPUT"
  data: string
  id: number
}

// ─── Offscreen Document Lifecycle ────────────────────────────────────

const OFFSCREEN_URL = "assets/offscreen.html";

let offscreenCreating = false;

async function ensureOffscreen(): Promise<void> {
  if ("getContexts" in chrome.runtime) {
    const contexts = await (chrome.runtime as typeof chrome.runtime & {
      getContexts: (filter: object) => Promise<object[]>
    }).getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
    });
    if (contexts.length > 0) return;
  }

  if (offscreenCreating) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!offscreenCreating) { clearInterval(check); resolve(); }
      }, 50);
    });
    return;
  }

  offscreenCreating = true;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["WORKERS" as chrome.offscreen.Reason],
      justification: "Runs the Stockfish WASM chess engine inside a Web Worker.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("single")) {
      console.error("[ChessHelper:BG] Failed to create offscreen document:", err);
      throw err;
    }
  } finally {
    offscreenCreating = false;
  }
}

// ─── Source Validation ────────────────────────────────────────────────

/**
 * Determine whether a message sender is authorised for a given action.
 *
 * Content scripts have sender.tab set.
 * The offscreen document has sender.id === runtime.id but NO sender.tab.
 * External web pages also lack sender.id matching the extension.
 */
function validateSender(
  sender: chrome.runtime.MessageSender,
  expectedOrigin: "content" | "offscreen"
): boolean {
  // All messages must originate from this extension
  if (sender.id !== chrome.runtime.id) return false;

  if (expectedOrigin === "content") {
    // Content scripts have a tab reference
    return !!sender.tab;
  }

  if (expectedOrigin === "offscreen") {
    // Offscreen document has no tab reference
    return !sender.tab;
  }

  return false;
}

// ─── Broadcasting ────────────────────────────────────────────────────

function broadcastToChessTabs(message: EngineOutputMessage): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url && tab.url.includes("chess.com")) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Content script may not be injected yet — safe to ignore
        });
      }
    }
  });
}

// ─── Message Router ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    // ── ENGINE_OUTPUT from offscreen → broadcast to chess tabs ──
    if (request.type === "ENGINE_OUTPUT") {
      if (!validateSender(sender, "offscreen")) {
        console.warn("[ChessHelper:BG] Rejected ENGINE_OUTPUT from unexpected sender");
        return false;
      }
      broadcastToChessTabs({
        type: "ENGINE_OUTPUT",
        data: request.data as string,
        id:   request.id as number,   // ← Sprint 1 Task 2: pass ID through
      });
      return false;
    }

    // ── Messages from content scripts ──
    switch (request.type) {

      case "INIT_ENGINE":
        if (!validateSender(sender, "content")) {
          sendResponse({ status: "error", error: "Unauthorized" });
          return true;
        }
        ensureOffscreen()
          .then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "INIT" }))
          .then((res) => sendResponse({ status: "ok", ...res }))
          .catch((err) => sendResponse({ status: "error", error: String(err) }));
        return true;

      case "ANALYZE": {
        if (!validateSender(sender, "content")) {
          sendResponse({ status: "error", error: "Unauthorized" });
          return true;
        }

        const { fen, id, depth, movetime } = request as AnalyzeRequest;

        if (!fen || typeof fen !== "string" || !fen.includes("/")) {
          sendResponse({ status: "error", error: "Invalid FEN string" });
          return true;
        }

        ensureOffscreen()
          .then(() => chrome.runtime.sendMessage({
            target:   "offscreen",
            type:     "ANALYZE",
            fen,
            id,                    // ← Sprint 1 Task 2: forward ID to offscreen
            depth,
            movetime,
          }))
          .then(() => sendResponse({ status: "analyzing" }))
          .catch((err) => sendResponse({ status: "error", error: String(err) }));
        return true;
      }

      case "STOP":
        chrome.runtime.sendMessage({ target: "offscreen", type: "STOP" }).catch(() => {});
        sendResponse({ status: "stopped" });
        return true;

      case "DEBUG_STATUS":
        ensureOffscreen()
          .then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "STATUS" }))
          .then((res) => sendResponse({ offscreenCreated: true, ...res }))
          .catch(() => sendResponse({ offscreenCreated: false, isEngineReady: false, hasWorker: false }));
        return true;

      default:
        return false;
    }
  }
);

console.log("[ChessHelper:BG] Background service worker loaded.");
