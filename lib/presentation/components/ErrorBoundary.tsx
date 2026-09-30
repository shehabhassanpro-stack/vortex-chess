import React, { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ChessHelper] React Error Boundary caught an error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            padding: "16px",
            background: "linear-gradient(145deg, #2d0e0e 0%, #161b22 100%)",
            border: "1px solid #f85149",
            borderRadius: "14px",
            color: "#c9d1d9",
            zIndex: 2147483647,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontSize: "13px",
            width: "clamp(240px, 20vw, 300px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              marginBottom: "12px",
              borderBottom: "1px solid rgba(248,81,73,0.3)",
              paddingBottom: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>💥</span>
            <span style={{ fontWeight: 700, color: "#f85149" }}>Extension Crashed</span>
          </div>
          <div style={{ color: "#8b949e", marginBottom: "10px" }}>
            An unexpected error occurred in the Chess Helper UI.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              width: "100%",
              background: "#21262d",
              border: "1px solid rgba(240,246,252,0.1)",
              color: "#c9d1d9",
              padding: "6px 0",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Try to Recover
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
