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
})
