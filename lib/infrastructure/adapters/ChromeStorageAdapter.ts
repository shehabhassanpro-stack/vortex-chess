import type { IStoragePort } from "../../domain/ports/IStoragePort"

export class ChromeStorageAdapter implements IStoragePort {
  get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve(undefined)
        return
      }
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] as T | undefined)
      })
    })
  }

  set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve()
        return
      }
      chrome.storage.local.set({ [key]: value }, () => {
        resolve()
      })
    })
  }

  onChanged(key: string, handler: (newValue: unknown) => void): () => void {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return () => {}
    }

    const listener = (changes: { [k: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes[key]) {
        handler(changes[key].newValue)
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }
}
