/**
 * Chess Helper AI — SAN Normalizer
 *
 * Pure domain service for sanitizing and validating Standard Algebraic Notation (SAN) strings.
 */

/**
 * Strip annotation symbols and non-SAN characters, keeping the bare move.
 * Valid SAN characters: letters, digits, +, #, =, -
 */
export function normaliseSan(raw: string): string {
  if (raw.includes("1-0") || raw.includes("0-1") || raw.includes("1/2")) return ""

  let s = raw.trim()
  s = s.replace(/^\d+\.+/, "") // Remove move numbers like "12." or "12..."

  return s
    .replace(/[!?]/g, "") // !, ?, !?, ?!, !!, ??
    .replace(/\$\d+/g, "") // PGN NAG codes ($1, $2 …)
    .replace(/[^\w=+#-]/g, "") // keep SAN-valid chars only
    .trim()
}

/**
 * Returns true if `s` looks like a valid SAN token (2–7 non-digit-only chars).
 */
export function looksLikeSan(s: string): boolean {
  if (s.length < 2 || s.length > 7) return false
  if (/^\d+\.*$/.test(s)) return false // move numbers with dots (e.g., "12." or "1...")
  if (/^\d+$/.test(s)) return false // pure numbers
  return true
}
