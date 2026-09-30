/**
 * Chess Helper AI — Shared Constants & Configuration Flags
 */

export { PIECE_MAP } from "../domain/services/BoardEncoder"
export { BOARD_SELECTORS as CHESS_COM_SELECTORS } from "../infrastructure/dom/selectors"

/**
 * 🔒 Master Fair Play & Bot-Only Constraint Switch
 *
 * - true  : Strictly restricts engine analysis to bot/computer games, puzzles, and analysis reviews.
 *           Hard-blocks live human games regardless of manual force settings.
 *           (Default setting for public repository & GitHub compliance).
 *
 * - false : Constraints disabled. Permissive mode across live games and online play.
 */
export const STRICT_BOT_ONLY_MODE: boolean =
  typeof process !== "undefined" && process.env?.PLASMO_PUBLIC_STRICT_BOT_ONLY !== undefined
    ? process.env.PLASMO_PUBLIC_STRICT_BOT_ONLY === "true"
    : true

