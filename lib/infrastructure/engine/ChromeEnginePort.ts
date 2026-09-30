import type {
  IEnginePort,
  AnalysisRequest,
  EngineCaps,
  EngineOutputPayload,
} from "../../domain/ports/IEnginePort"
import type {
  AnalyzeMessage,
  InitMessage,
  StopMessage,
  IncomingMessage,
  EngineOutputMessage,
  EngineCapsMessage,
  EngineFatalErrorMessage,
} from "../../core/types"

export class ChromeEnginePort implements IEnginePort {
  initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const msg: InitMessage = { type: "INIT_ENGINE" }
      this.sendMessage(msg, (response) => {
        if (response && response.status === "error") {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }

  analyze(request: AnalysisRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      const msg: AnalyzeMessage = {
        type: "ANALYZE",
        fen: request.fen,
        id: request.id,
        correlationId: request.correlationId,
        profile: request.profile,
        limits: request.limits,
      }
      this.sendMessage(msg, (response) => {
        if (response && response.status === "error") {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }

  stop(correlationId?: string): Promise<void> {
    return new Promise((resolve) => {
      const msg: StopMessage = { type: "STOP", correlationId }
      this.sendMessage(msg, () => resolve())
    })
  }

  getCaps(): Promise<EngineCaps> {
    return new Promise((resolve) => {
      this.sendMessage({ type: "GET_CAPS" }, (response) => {
        if (response && typeof response.eloMin === "number") {
          resolve({
            eloMin: response.eloMin,
            eloMax: response.eloMax,
            supportsLimitStrength: !!response.supportsLimitStrength,
          })
        } else {
          resolve({ eloMin: 0, eloMax: 0, supportsLimitStrength: false })
        }
      })
    })
  }

  onOutput(handler: (payload: EngineOutputPayload) => void): () => void {
    const listener = (msg: IncomingMessage) => {
      if (msg && msg.type === "ENGINE_OUTPUT") {
        const out = msg as EngineOutputMessage
        handler({
          data: out.data,
          id: out.id,
          correlationId: out.correlationId,
        })
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }

  onCaps(handler: (caps: EngineCaps) => void): () => void {
    const listener = (msg: IncomingMessage) => {
      if (msg && msg.type === "ENGINE_CAPS") {
        const caps = msg as EngineCapsMessage
        handler({
          eloMin: caps.eloMin,
          eloMax: caps.eloMax,
          supportsLimitStrength: caps.supportsLimitStrength,
        })
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }

  onFatalError(handler: (error: string) => void): () => void {
    const listener = (msg: IncomingMessage) => {
      if (msg && msg.type === "ENGINE_FATAL_ERROR") {
        const err = msg as EngineFatalErrorMessage
        handler(err.error || "Engine crashed unexpectedly")
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }

  private sendMessage(
    msg: unknown,
    callback?: (response: {
      status?: string
      error?: string
      eloMin?: number
      eloMax?: number
      supportsLimitStrength?: boolean
    }) => void,
  ): void {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      callback?.({ status: "error", error: "chrome.runtime unavailable" })
      return
    }

    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          // ignore or handle
        }
        callback?.(response)
      })
    } catch {
      callback?.({ status: "error", error: "sendMessage failed" })
    }
  }
}
