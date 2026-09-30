/**
 * Chess Helper AI — DOM Selectors
 *
 * Centralized registry of all CSS selectors for Chess.com DOM elements.
 */

/** CSS selectors for Chess.com board elements */
export const BOARD_SELECTORS = {
  BOARD: "chess-board",
  PIECE: ".piece",
  CLOCK_WHITE: ".clock-white.clock-player-turn",
  CLOCK_BLACK: ".clock-black.clock-player-turn",
} as const

/** CSS selectors for move list containers (ordered by specificity) */
export const MOVE_LIST_SELECTORS = [
  "wc-simple-move-list",
  "vertical-move-list",
  ".move-list-wrapper",
  "chess-moves-simple",
  "[data-cy='move-list']",
  ".moves-wrapper",
  "rml",
  ".moves",
] as const

/** CSS selectors for individual move nodes within a container */
export const MOVE_NODE_SELECTORS = [
  "span.node-highlight-content",
  ".node",
  ".move-list-row .node",
  "[data-movelistsquare]",
  ".main-line-ply",
  ".move-san",
] as const

/** CSS selectors for puzzle text elements */
export const PUZZLE_TEXT_SELECTORS =
  ".message-component, .puzzle-message-component, h3, .status-title, .title-text, [data-cy='turn-indicator']"
