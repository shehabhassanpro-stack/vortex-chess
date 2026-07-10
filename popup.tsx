import { useEffect, useState } from "react"
import "./style.css"

function IndexPopup() {
  const [enabled, setEnabled] = useState(true)
  const [engineStatus, setEngineStatus] = useState<"loading" | "ready" | "error">("loading")

  // Sync initial state and listen for changes
  useEffect(() => {
    // Load saved state
    chrome.storage.local.get(["analysisEnabled"], (result) => {
      if (result.analysisEnabled !== undefined) {
        setEnabled(result.analysisEnabled)
      }
    })

    // Check engine status
    chrome.runtime.sendMessage({ type: "INIT_ENGINE" }, (response) => {
      if (chrome.runtime.lastError) {
        setEngineStatus("error")
      } else if (response?.status === "ok") {
        setEngineStatus("ready")
      } else {
        setEngineStatus("error")
      }
    })
  }, [])

  const toggleEnabled = () => {
    const newState = !enabled
    setEnabled(newState)

    // Persist to storage so content script can read it
    chrome.storage.local.set({ analysisEnabled: newState })

    // Notify active tab
    if (!newState) {
      chrome.runtime.sendMessage({ type: "STOP" })
    }
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <span className="popup-icon">♟</span>
        <h2>Chess Helper AI</h2>
      </div>

      {/* Engine Status */}
      <div className="popup-status">
        <span className={`status-dot ${engineStatus}`} />
        <span>
          Engine:{" "}
          {engineStatus === "loading"
            ? "Loading..."
            : engineStatus === "ready"
            ? "Stockfish Ready"
            : "Error"}
        </span>
      </div>

      {/* Toggle Button */}
      <button
        className={`toggle-btn ${enabled ? "active" : "inactive"}`}
        onClick={toggleEnabled}>
        {enabled ? "⏸ Disable Analysis" : "▶ Enable Analysis"}
      </button>

      {/* Info */}
      <p className="popup-info">
        Analysis is {enabled ? "active" : "paused"} on Chess.com and Lichess.
      </p>
    </div>
  )
}

export default IndexPopup
