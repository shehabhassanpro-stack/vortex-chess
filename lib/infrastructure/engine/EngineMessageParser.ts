export interface ParsedEngineInfo {
  depth: number | null
  scoreCp: number | null
  scoreMate: number | null
  formattedScore: string | null
}

/**
 * Parses a standard UCI info line to extract depth and score information.
 * Example line: "info depth 15 seldepth 22 multipv 1 score cp 45 nodes 12345 nps 6789 time 123 pv e2e4"
 */
export function parseEngineInfo(line: string): ParsedEngineInfo {
  const result: ParsedEngineInfo = {
    depth: null,
    scoreCp: null,
    scoreMate: null,
    formattedScore: null,
  }

  if (!line.startsWith("info") || !line.includes(" pv ")) {
    return result
  }

  const depthMatch = line.match(/\bdepth\s+(\d+)/)
  if (depthMatch) {
    result.depth = parseInt(depthMatch[1], 10)
  }

  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)
  if (scoreMatch) {
    const type = scoreMatch[1]
    const val = parseInt(scoreMatch[2], 10)

    if (type === "cp") {
      result.scoreCp = val
      const s = (val / 100).toFixed(2)
      result.formattedScore = val >= 0 ? `+${s}` : s
    } else {
      result.scoreMate = val
      result.formattedScore = `M${Math.abs(val)}`
    }
  }

  return result
}
