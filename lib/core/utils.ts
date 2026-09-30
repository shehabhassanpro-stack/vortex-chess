/**
 * Utility functions
 */

/**
 * Generates a universally unique identifier (UUID v4).
 * Uses crypto.randomUUID() if available (secure contexts), otherwise falls back to a math-based approach.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  // Fallback for non-secure contexts
  const pattern = "10000000-1000-4000-8000-100000000000"
  return pattern.replace(/[018]/g, (c) => {
    const num = parseInt(c, 10)
    const randomByte = crypto.getRandomValues(new Uint8Array(1))[0]
    return (num ^ (randomByte & (15 >> (num / 4)))).toString(16)
  })
}

/**
 * Safely sends a message via chrome.runtime.sendMessage, catching
 * and ignoring common "Receiving end does not exist" errors that happen
 * during extension reloads or rapid tab changes.
 */
export function sendMessageSafe(msg: unknown, callback?: (response: unknown) => void): void {
  try {
    if (callback) {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message || ""
          if (!err.includes("Receiving end does not exist")) {
            console.warn("[ChessHelper] sendMessage warning:", err)
          }
        }
        callback(response)
      })
    } else {
      chrome.runtime.sendMessage(msg).catch((err) => {
        const msgStr = String(err)
        if (
          !msgStr.includes("Receiving end does not exist") &&
          !msgStr.includes("message port closed")
        ) {
          console.warn("[ChessHelper] sendMessageSafe error:", err)
        }
      })
    }
  } catch (err) {
    console.warn("[ChessHelper] sendMessageSafe exception:", err)
  }
}
