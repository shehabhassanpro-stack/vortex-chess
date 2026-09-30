export interface IStoragePort {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  onChanged(key: string, handler: (newValue: unknown) => void): () => void
}
