import { useEffect } from "react"
import type { IEnginePort, EngineCaps, EngineOutputPayload } from "../../domain/ports/IEnginePort"

export interface UseEngineMessagesOptions {
  enginePort: IEnginePort
  onOutput: (payload: EngineOutputPayload) => void
  onCaps?: (caps: EngineCaps) => void
  onFatalError?: (error: string) => void
}

export function useEngineMessages({
  enginePort,
  onOutput,
  onCaps,
  onFatalError,
}: UseEngineMessagesOptions): void {
  useEffect(() => {
    const unsubOutput = enginePort.onOutput(onOutput)
    const unsubCaps = onCaps ? enginePort.onCaps(onCaps) : () => {}
    const unsubFatal = onFatalError ? enginePort.onFatalError(onFatalError) : () => {}

    return () => {
      unsubOutput()
      unsubCaps()
      unsubFatal()
    }
  }, [enginePort, onOutput, onCaps, onFatalError])
}
