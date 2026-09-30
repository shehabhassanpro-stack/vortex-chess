import { useEffect, useState, useMemo } from "react"
import { ChromeStorageAdapter } from "./lib/infrastructure/adapters/ChromeStorageAdapter"
import "./style.css"

function IndexPopup() {
  const [enabled, setEnabled] = useState(true)
  const [engineStatus, setEngineStatus] = useState<"loading" | "ready" | "error">("loading")
  const storage = useMemo(() => new ChromeStorageAdapter(), [])

  useEffect(() => {
    // Load saved state from storage adapter
    storage.get<boolean>("analysisEnabled").then((val) => {
      if (val !== undefined) {
        setEnabled(val)
      }
    })

    // Check engine status
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "INIT_ENGINE" }, (response) => {
        if (chrome.runtime.lastError) {
          setEngineStatus("error")
        } else if (response?.status === "ok") {
          setEngineStatus("ready")
        } else {
          setEngineStatus("error")
        }
      })
    }
  }, [storage])

  const toggleEnabled = () => {
    const newState = !enabled
    setEnabled(newState)

    // Persist to storage
    storage.set("analysisEnabled", newState)

    // Notify background/engine
    if (!newState && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "STOP" })
    }
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <span className="popup-icon">⚡</span>
        <h2>Vortex</h2>
      </div>

      {/* Engine Status */}
      <div className="popup-status">
        <span className={`status-dot ${engineStatus}`} />
        <span>
          Engine:{" "}
          {engineStatus === "loading"
            ? "Initializing..."
            : engineStatus === "ready"
              ? "Vortex Engine Active"
              : "Error"}
        </span>
      </div>

      {/* Toggle Button */}
      <button className={`toggle-btn ${enabled ? "active" : "inactive"}`} onClick={toggleEnabled}>
        {enabled ? "⏸ Disable Analysis" : "▶ Enable Analysis"}
      </button>

      {/* Info */}
      <p className="popup-info">Analysis is {enabled ? "active" : "paused"} on Chess.com.</p>
    </div>
  )
}

export default IndexPopup
