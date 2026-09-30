import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDebounce } from "./useDebounce"

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test("should not trigger callback immediately", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current.trigger()
    })

    expect(callback).not.toHaveBeenCalled()
  })

  test("should trigger callback after default delay", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current.trigger()
    })

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  test("should debounce multiple rapid triggers into a single call", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current.trigger()
      vi.advanceTimersByTime(50)
      result.current.trigger() // resets timer
      vi.advanceTimersByTime(50)
      result.current.trigger() // resets timer again
    })

    act(() => {
      vi.advanceTimersByTime(99)
    })
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  test("should support overriding the delay dynamically", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current.trigger(300) // Override with 300ms
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })
    // 150ms has passed, but we override to 300ms, so it shouldn't be called
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  test("should clear the timer when clear() is called", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current.trigger()
    })

    act(() => {
      vi.advanceTimersByTime(50)
      result.current.clear()
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(callback).not.toHaveBeenCalled()
  })

  test("should auto-clear timer on unmount", () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current.trigger()
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(callback).not.toHaveBeenCalled()
  })
})
