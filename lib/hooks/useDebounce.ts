import { useRef, useCallback, useEffect } from "react"

/**
 * A custom hook to manage a debounced callback, automatically clearing the timer on unmount.
 *
 * @param callback The function to execute after the delay
 * @param delay    The delay in milliseconds (can be updated dynamically)
 */
export function useDebounce(callback: () => void, defaultDelay: number = 150) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // Keep callback ref fresh without triggering re-renders
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const trigger = useCallback(
    (overrideDelay?: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      const finalDelay = overrideDelay !== undefined ? overrideDelay : defaultDelay
      timerRef.current = setTimeout(() => {
        callbackRef.current()
      }, finalDelay)
    },
    [defaultDelay],
  )

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return clear
  }, [clear])

  return { trigger, clear }
}
