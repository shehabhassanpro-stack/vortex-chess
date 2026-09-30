/**
 * Chess Helper AI — Shared Debug Utilities
 *
 * Single source of truth for debug logging across all modules.
 * Enable via: window.__CHESS_HELPER_DEBUG = true in DevTools.
 */

/** Returns true when the debug flag is set in the window object. */
export function isDebug(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as Window & { __CHESS_HELPER_DEBUG?: boolean }).__CHESS_HELPER_DEBUG
  )
}

/**
 * Emit a tagged debug log line. No-ops in production (flag not set).
 * @param tag   - Module identifier, e.g. "content", "GameTracker"
 * @param args  - Values to log
 */
export function dbg(tag: string, ...args: unknown[]): void {
  if (isDebug()) console.log(`[ChessHelper:${tag}]`, ...args)
}
