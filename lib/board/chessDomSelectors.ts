/**
 * Chess Helper AI — Move List Container Selectors
 *
 * CSS selectors used to locate the move list element across all known
 * Chess.com page layouts and DOM structures (2024–2026).
 */

export const MOVE_LIST_SELECTORS = [
  "wc-simple-move-list", // SPA component (2024+), analysis & standard games
  "vertical-move-list", // Classic game page
  ".move-list-wrapper", // Older wrapper
  "chess-moves-simple", // Embedded boards, studies
  "[data-cy='move-list']", // E2E testing selector used in some layouts
  ".moves-wrapper", // Alternative wrapper
  "rml", // Rapid move list
  ".moves", // Legacy/puzzle move list
] as const
