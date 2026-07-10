import { describe, test, expect, beforeEach } from 'vitest'
import { GameTracker } from './gameTracker'

describe("GameTracker sync()", () => {
  let tracker: GameTracker

  beforeEach(() => {
    tracker = new GameTracker()
    document.body.innerHTML = ''
    // minimal mock to avoid errors
    Object.defineProperty(window, 'location', {
      value: { pathname: '/analysis' },
      writable: true
    })
  })

  test("empty move list → starting position, turn = w", () => {
    document.body.innerHTML = '<div class="move-list-wrapper"></div>'
    
    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    expect(state?.turn).toBe("w")
    expect(state?.plyCount).toBe(0)
  })

  test("turn comes exclusively from chess.js after 15 moves", () => {
    // 15 plies (e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3)
    const sans = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3"]
    
    document.body.innerHTML = `
      <div class="move-list-wrapper">
        ${sans.map(san => `<div class="node"><span class="node-highlight-content">${san}</span></div>`).join('')}
      </div>
    `
    
    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.turn).toBe("b") // After 15 plies, it's Black's turn
    expect(state?.plyCount).toBe(15)
  })

  test("cache invalidated on takeback+new-move at same ply count", () => {
    document.body.innerHTML = `
      <div class="move-list-wrapper">
        <div class="node"><span class="node-highlight-content">e4</span></div>
        <div class="node"><span class="node-highlight-content">e5</span></div>
        <div class="node"><span class="node-highlight-content">Nf3</span></div>
      </div>
    `
    const state1 = tracker.sync()
    expect(state1?.turn).toBe("b")
    const fen1 = state1?.fen

    document.body.innerHTML = `
      <div class="move-list-wrapper">
        <div class="node"><span class="node-highlight-content">e4</span></div>
        <div class="node"><span class="node-highlight-content">e5</span></div>
        <div class="node"><span class="node-highlight-content">d4</span></div>
      </div>
    `
    const state2 = tracker.sync()
    expect(state2?.plyCount).toBe(3)
    expect(state2?.fen).not.toBe(fen1)
  })

  test("figurine node structure parsed correctly (Task 3)", () => {
    document.body.innerHTML = `
      <div class="move-list-wrapper">
        <div class="node"><span class="node-highlight-content">e4</span></div>
        <div class="node"><span class="node-highlight-content">e5</span></div>
        <div class="node">
          <span class="node-highlight-content">
            <span data-figurine="N" class="icon-font-chess knight-white"></span>e2
          </span>
        </div>
      </div>
    `
    // e4 e5 Ne2
    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.plyCount).toBe(3)
    expect(state?.turn).toBe("b")
  })

  test("captures, promotions, castling, and disambiguations parsed correctly", () => {
    // 1. e4 d5 2. exd5 Nf6 3. Bb5+ Nbd7 4. Ne2 e6 5. dxe6 Bd6 6. exf7+ Kf8 7. O-O
    const moves = [
      "e4", "d5", 
      "exd5", `<span data-figurine="N"></span>f6`, 
      `<span data-figurine="B"></span>b5+`, `<span data-figurine="N"></span>bd7`, 
      `<span data-figurine="N"></span>e2`, "e6", 
      "dxe6", `<span data-figurine="B"></span>d6`, 
      "exf7+", `<span data-figurine="K"></span>f8`, 
      "O-O"
    ]
    document.body.innerHTML = `
      <div class="move-list-wrapper">
        ${moves.map(san => `<div class="node"><span class="node-highlight-content">${san}</span></div>`).join('')}
      </div>
    `
    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.plyCount).toBe(13)
    expect(state?.turn).toBe("b")
  })

  test("corrupt text → explicit failure without partial FEN", () => {
    document.body.innerHTML = `
      <div class="move-list-wrapper">
        <div class="node"><span class="node-highlight-content">e4</span></div>
        <div class="node"><span class="node-highlight-content">e5</span></div>
        <div class="node"><span class="node-highlight-content">XYZ</span></div>
      </div>
    `
    const state = tracker.sync()
    expect(state).toBeNull() // Entire replay fails
  })

  test("non-breaking spaces and move numbers are stripped", () => {
    document.body.innerHTML = `
      <div class="move-list-wrapper">
        <div class="node"><span class="node-highlight-content">1.\u00A0e4</span></div>
        <div class="node"><span class="node-highlight-content">1...\u200Be5</span></div>
      </div>
    `
    const state = tracker.sync()
    expect(state).not.toBeNull()
    expect(state?.plyCount).toBe(2)
  })
})
