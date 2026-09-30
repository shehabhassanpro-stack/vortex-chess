import type { AnalysisContext } from "../../core/types"

export class AnalysisContextRegistry {
  private readonly map = new Map<string, AnalysisContext>()
  private readonly cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly ttlMs = 60_000,
    autoPrune = true,
  ) {
    if (autoPrune) {
      this.cleanupInterval = setInterval(() => this.prune(), 30_000)
    }
  }

  register(ctx: AnalysisContext): void {
    this.map.set(ctx.correlationId, ctx)
  }

  lookup(correlationId: string): AnalysisContext | undefined {
    return this.map.get(correlationId)
  }

  prune(customTtl?: number): void {
    const ttl = customTtl ?? this.ttlMs
    const now = Date.now()
    for (const [key, val] of this.map.entries()) {
      if (now - val.timestamp > ttl) {
        this.map.delete(key)
      }
    }
  }

  clear(): void {
    this.map.clear()
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clear()
  }
}
