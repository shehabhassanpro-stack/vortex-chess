import { describe, test, expect, vi } from "vitest"
import { ComplianceService } from "./ComplianceService"
import type { IGameContextProvider } from "../../domain/ports/IGameContextProvider"

describe("ComplianceService", () => {
  test("live context triggers showWarning", () => {
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("live"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const service = new ComplianceService(mockContext)
    const status = service.check(false)
    expect(status.showWarning).toBe(true)
    expect(status.blocked).toBe(false)
    expect(status.context).toBe("live")
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

    // Forced bypass
    const forcedStatus = service.check(true)
    expect(forcedStatus.blocked).toBe(false)
  })

  test("puzzle/computer context allows analysis without warning", () => {
    const mockContext: IGameContextProvider = {
      getContext: vi.fn().mockReturnValue("puzzle"),
      isAnalysisPermitted: vi.fn().mockReturnValue(true),
    }
    const service = new ComplianceService(mockContext)
    const status = service.check(false)
    expect(status.blocked).toBe(false)
    expect(status.showWarning).toBe(false)
  })
})
