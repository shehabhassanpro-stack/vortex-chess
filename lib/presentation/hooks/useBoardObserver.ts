import { useEffect, useRef, useState, useCallback } from "react"
import type { IBoardReader } from "../../domain/ports/IBoardReader"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"
import type { IMoveListReader } from "../../domain/ports/IMoveListReader"
import type { PuzzleState } from "../../board/activeColorDetector"
import { useDebounce } from "../../hooks/useDebounce"

export interface UseBoardObserverOptions {
  isActive: boolean
  boardReader: IBoardReader
  contextProvider: IGameContextProvider
  moveListReader: IMoveListReader
  puzzleState: PuzzleState
  onBoardChange: () => void
}

export function useBoardObserver({
  isActive,
  boardReader,
  contextProvider,
  moveListReader,
  puzzleState,
  onBoardChange,
}: UseBoardObserverOptions): { isFlipped: boolean } {
  const [isFlipped, setIsFlipped] = useState(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { trigger: triggerDebouncedChange, clear: clearDebounce } = useDebounce(onBoardChange, 150)

  const attachObserver = useCallback(() => {
    if (observerRef.current) return

    const geoData = boardReader.read()
    if (!geoData) return

    const { boardEl, isFlipped: flipped } = geoData
    setIsFlipped(flipped)

    const observer = new MutationObserver(() => {
      setIsFlipped(boardReader.checkIsFlipped(boardEl))

      const context = contextProvider.getContext()
      const isUnsettledPuzzle = context === "puzzle" && !puzzleState.settled
      const puzzleNoMovelist = context === "puzzle" && moveListReader.findContainer() === null

      let delay = 50
      if (isUnsettledPuzzle || puzzleNoMovelist) delay = 500
      else if (context === "live") delay = 150

      triggerDebouncedChange(delay)
    })

    const target =
      boardEl.shadowRoot?.querySelector(".board, .pieces, [class*='board']") ??
      boardEl.querySelector(".board, .pieces, [class*='board']") ??
      boardEl

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    })
    observerRef.current = observer

    if (retryRef.current) {
      clearInterval(retryRef.current)
      retryRef.current = null
    }

    triggerDebouncedChange(200)
  }, [boardReader, contextProvider, moveListReader, puzzleState, triggerDebouncedChange])

  useEffect(() => {
    if (!isActive) {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (retryRef.current) {
        clearInterval(retryRef.current)
        retryRef.current = null
      }
      clearDebounce()
      return
    }

    attachObserver()

    if (!observerRef.current) {
      retryRef.current = setInterval(attachObserver, 500)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (retryRef.current) {
        clearInterval(retryRef.current)
        retryRef.current = null
      }
      clearDebounce()
    }
  }, [isActive, attachObserver, clearDebounce])

  return { isFlipped }
}
