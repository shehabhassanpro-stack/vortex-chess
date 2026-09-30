import { describe, test, expect, vi } from "vitest"
import { ComplianceService } from "./ComplianceService"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"

describe("ComplianceService", () => {
  test("live context is strictly blocked with warning even if forced (bots-only constraint)", () => {
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("live"),
      isAnalysisPermitted: vi.fn().mockReturnValue(false),
    }
    const service = new ComplianceService(mockContext)
    const status = service.check(false)
    expect(status.showWarning).toBe(true)
    expect(status.blocked).toBe(true)
    expect(status.context).toBe("live")

    // Hard constraint: forced override also remains blocked in live games
    const forcedStatus = service.check(true)
    expect(forcedStatus.blocked).toBe(true)
  })

  test("home context without force is blocked", () => {
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("home"),
      isAnalysisPermitted: vi.fn().mockReturnValue(false),
    }
    const service = new ComplianceService(mockContext)
    const status = service.check(false)
    expect(status.blocked).toBe(true)
    expect(status.showWarning).toBe(false)

    // Manual force can override home context
    const forcedStatus = service.check(true)
    expect(forcedStatus.blocked).toBe(false)
  })

  test("computer/bot context allows analysis without warning", () => {
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("computer"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const service = new ComplianceService(mockContext)
    const status = service.check(false)
    expect(status.blocked).toBe(false)
    expect(status.showWarning).toBe(false)
  })
})
