import { describe, test, expect, vi, beforeEach } from "vitest"
import { sendMessageSafe, generateUUID } from "./utils"

// Mock global chrome
const mockSendMessage = vi.fn()
Object.defineProperty(globalThis, "chrome", {
  value: {
    runtime: {
      sendMessage: mockSendMessage,
      lastError: undefined,
    },
  },
  writable: true,
})

describe("utils", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.chrome.runtime.lastError = undefined
  })

  describe("generateUUID", () => {
    test("should generate valid v4 UUID formats", () => {
      const uuid = generateUUID()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    test("should generate unique values", () => {
      const uuid1 = generateUUID()
      const uuid2 = generateUUID()
      expect(uuid1).not.toBe(uuid2)
    })
  })

  describe("sendMessageSafe", () => {
    test("should send message using chrome.runtime.sendMessage", () => {
      mockSendMessage.mockImplementationOnce(() => Promise.resolve())
      sendMessageSafe({ type: "TEST" })
      expect(mockSendMessage).toHaveBeenCalledWith({ type: "TEST" })
    })

    test("should catch and ignore 'Receiving end does not exist' promise rejections", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      mockSendMessage.mockImplementationOnce(() =>
        Promise.reject(new Error("Could not establish connection. Receiving end does not exist.")),
      )

      sendMessageSafe({ type: "TEST" })

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleWarnSpy).not.toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })

    test("should log warnings for other types of promise rejections", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const err = new Error("Some fatal extension error")
      mockSendMessage.mockImplementationOnce(() => Promise.reject(err))

      sendMessageSafe({ type: "TEST" })

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleWarnSpy).toHaveBeenCalledWith("[ChessHelper] sendMessageSafe error:", err)
      consoleWarnSpy.mockRestore()
    })

    test("should support callbacks and ignore 'Receiving end does not exist' in lastError", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      mockSendMessage.mockImplementationOnce((_msg: unknown, cb: (res: unknown) => void) => {
        globalThis.chrome.runtime.lastError = {
          message: "Could not establish connection. Receiving end does not exist.",
        }
        cb({ status: "ok" })
      })

      const cb = vi.fn()
      sendMessageSafe({ type: "TEST" }, cb)

      expect(cb).toHaveBeenCalledWith({ status: "ok" })
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    test("should warn on unhandled lastError that is not 'Receiving end does not exist'", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      mockSendMessage.mockImplementationOnce((_msg: unknown, cb: (res: unknown) => void) => {
        globalThis.chrome.runtime.lastError = { message: "Unexpected failure" }
        cb(null)
      })

      const cb = vi.fn()
      sendMessageSafe({ type: "TEST" }, cb)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[ChessHelper] sendMessage warning:",
        "Unexpected failure",
      )

      consoleWarnSpy.mockRestore()
    })

    test("should catch synchronous exceptions in chrome.runtime.sendMessage", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const err = new Error("Sync crash")
      mockSendMessage.mockImplementationOnce(() => {
        throw err
      })

      sendMessageSafe({ type: "TEST" })

      expect(consoleWarnSpy).toHaveBeenCalledWith("[ChessHelper] sendMessageSafe exception:", err)
      consoleWarnSpy.mockRestore()
    })
  })
})
