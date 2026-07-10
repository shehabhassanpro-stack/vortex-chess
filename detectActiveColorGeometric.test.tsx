import { describe, test, expect, beforeEach } from 'vitest'
import { detectActiveColorGeometric } from './content'

describe("detectActiveColorGeometric", () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // Default context mock
    Object.defineProperty(window, 'location', {
      value: { pathname: '/analysis' },
      writable: true
    })
  })

  test("Strategy 1: active clock present → clock wins over all strategies", () => {
    document.body.innerHTML = '<div class="clock-white clock-player-turn"></div>'
    // Even if diff or orientation suggests black, clock white should win
    const result = detectActiveColorGeometric([], "diff1", "b", true)
    expect(result.turn).toBe("w")
    expect(result.reliable).toBe(true)
  })

  test("Strategy 2: board changed since last call → flip turn", () => {
    // No clock, use diff
    const prevSig = ".......P|........"
    const currentBoard = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["P", null, null, null, null, null, null, null]
    ] // this encodes to a different string
    
    const result = detectActiveColorGeometric(currentBoard, prevSig, "w", false)
    expect(result.turn).toBe("b") // board changed, so turn flips from w to b
    expect(result.reliable).toBe(true)
  })

  test("Strategy 2: board unchanged → return same turn", () => {
    const boardArr = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, "P"]
    ]
    // Mock the encoding logic for the test to match prevSig
    const prevSig = boardArr.map(row => row.map(c => c ?? ".").join("")).join("|")
    const result = detectActiveColorGeometric(boardArr, prevSig, "b", false)
    expect(result.turn).toBe("b") // board unchanged, turn stays b
    expect(result.reliable).toBe(true)
  })

  test("Strategy 3: Puzzle text 'White to move'", () => {
    document.body.innerHTML = '<div class="message-component">White to move</div>'
    const result = detectActiveColorGeometric([], "", "unknown", true)
    expect(result.turn).toBe("w")
    expect(result.reliable).toBe(true)
  })

  test("Strategy 4: Board Orientation (Task 1) - puzzle flipped", () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/puzzles' },
      writable: true
    })
    
    // Flipped board -> Black's turn
    const result = detectActiveColorGeometric([], "", "unknown", true)
    expect(result.turn).toBe("b")
    expect(result.reliable).toBe(true)
  })

  test("Strategy 5: first extraction (prevSig='') → piece count strategy", () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/unknown' },
      writable: true
    })
    const startBoard = [
      ["r", "n", "b", "q", "k", "b", "n", "r"],
      ["p", "p", "p", "p", "p", "p", "p", "p"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["P", "P", "P", "P", "P", "P", "P", "P"],
      ["R", "N", "B", "Q", "K", "B", "N", "R"]
    ]
    const result = detectActiveColorGeometric(startBoard, "", "unknown", false)
    expect(result.turn).toBe("unknown") // tied piece count = unknown
    expect(result.reliable).toBe(false)
  })

  test("Strategy 5: unbalanced piece count → unreliable turn", () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/unknown' },
      writable: true
    })
    const board = [
      ["r", "n", "b", "q", "k", "b", "n", "r"], // 8 black
      [null, null, null, null, null, null, null, null], // 0 pawns
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["P", "P", "P", "P", "P", "P", "P", "P"], // 8 white
      ["R", "N", "B", "Q", "K", "B", "N", "R"] // 8 white
    ]
    const result = detectActiveColorGeometric(board, "", "unknown", false)
    expect(result.turn).toBe("b") // 16 white > 8 black -> Black has fewer pieces, so it's Black's turn
    expect(result.reliable).toBe(false)
  })
})
