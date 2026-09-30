import { useEffect, useRef } from "react"

export interface UseSpaNavigationOptions {
  isActive: boolean
  onNavigate: () => void
}

export function useSpaNavigation({ isActive, onNavigate }: UseSpaNavigationOptions): void {
  const lastPathRef = useRef(typeof window !== "undefined" ? window.location.pathname : "")

  useEffect(() => {
    const handleNavigation = () => {
      const currentPath = window.location.pathname
      if (currentPath === lastPathRef.current) return
      lastPathRef.current = currentPath

      onNavigate()
    }

    if (typeof window !== "undefined" && "navigation" in window) {
      const nav = (window as Window & { navigation: EventTarget }).navigation
      nav.addEventListener("navigate", handleNavigation)
      return () => nav.removeEventListener("navigate", handleNavigation)
    }

    const pollInterval = setInterval(handleNavigation, 1000)
    return () => clearInterval(pollInterval)
  }, [isActive, onNavigate])
}
