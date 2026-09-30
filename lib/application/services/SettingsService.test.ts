import { describe, it, expect, vi, beforeEach } from "vitest"
import { SettingsService, DEFAULT_USER_SETTINGS } from "./SettingsService"
import type { IStoragePort } from "../../domain/ports/IStoragePort"

describe("SettingsService", () => {
  let mockStorage: IStoragePort
  let service: SettingsService

  beforeEach(() => {
    mockStorage = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      onChanged: vi.fn().mockReturnValue(() => {}),
    }
    service = new SettingsService(mockStorage)
  })

  it("should return default settings when storage is empty", async () => {
    vi.mocked(mockStorage.get).mockResolvedValue(undefined)
    const settings = await service.loadSettings()
    expect(settings).toEqual(DEFAULT_USER_SETTINGS)
  })

  it("should load persisted settings correctly", async () => {
    vi.mocked(mockStorage.get).mockImplementation(async (key: string) => {
      if (key === "vortex_preset_id") return "expert"
      if (key === "vortex_speed_mode") return "deep"
      if (key === "vortex_brilliant_enabled") return false
      if (key === "vortex_compact_mode") return true
      return undefined
    })

    const settings = await service.loadSettings()
    expect(settings).toEqual({
      presetId: "expert",
      speedMode: "deep",
      brilliantEnabled: false,
      compactMode: true,
    })
  })

  it("should save individual setting properly", async () => {
    await service.saveSetting("speedMode", "normal")
    expect(mockStorage.set).toHaveBeenCalledWith("vortex_speed_mode", "normal")
  })

  it("should save multiple settings with saveAll", async () => {
    await service.saveAll({ presetId: "master", brilliantEnabled: true })
    expect(mockStorage.set).toHaveBeenCalledWith("vortex_preset_id", "master")
    expect(mockStorage.set).toHaveBeenCalledWith("vortex_brilliant_enabled", true)
  })
})
