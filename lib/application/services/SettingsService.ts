import type { IStoragePort } from "../../domain/ports/IStoragePort"
import type { UserSettings, SpeedMode } from "../../domain/types"

export const DEFAULT_USER_SETTINGS: UserSettings = {
  presetId: "club",
  speedMode: "fast",
  brilliantEnabled: true,
  compactMode: false,
}

export class SettingsService {
  constructor(private readonly storagePort: IStoragePort) {}

  async loadSettings(): Promise<UserSettings> {
    try {
      const [presetId, speedMode, brilliantEnabled, compactMode] = await Promise.all([
        this.storagePort.get<string>("vortex_preset_id"),
        this.storagePort.get<SpeedMode>("vortex_speed_mode"),
        this.storagePort.get<boolean>("vortex_brilliant_enabled"),
        this.storagePort.get<boolean>("vortex_compact_mode"),
      ])

      return {
        presetId: presetId ?? DEFAULT_USER_SETTINGS.presetId,
        speedMode: speedMode ?? DEFAULT_USER_SETTINGS.speedMode,
        brilliantEnabled: brilliantEnabled ?? DEFAULT_USER_SETTINGS.brilliantEnabled,
        compactMode: compactMode ?? DEFAULT_USER_SETTINGS.compactMode,
      }
    } catch {
      return { ...DEFAULT_USER_SETTINGS }
    }
  }

  async saveSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void> {
    const storageKeyMap: Record<keyof UserSettings, string> = {
      presetId: "vortex_preset_id",
      speedMode: "vortex_speed_mode",
      brilliantEnabled: "vortex_brilliant_enabled",
      compactMode: "vortex_compact_mode",
    }

    const storageKey = storageKeyMap[key]
    if (storageKey) {
      await this.storagePort.set(storageKey, value)
    }
  }

  async saveAll(settings: Partial<UserSettings>): Promise<void> {
    const promises: Promise<void>[] = []
    if (settings.presetId !== undefined) {
      promises.push(this.saveSetting("presetId", settings.presetId))
    }
    if (settings.speedMode !== undefined) {
      promises.push(this.saveSetting("speedMode", settings.speedMode))
    }
    if (settings.brilliantEnabled !== undefined) {
      promises.push(this.saveSetting("brilliantEnabled", settings.brilliantEnabled))
    }
    if (settings.compactMode !== undefined) {
      promises.push(this.saveSetting("compactMode", settings.compactMode))
    }
    await Promise.all(promises)
  }
}
