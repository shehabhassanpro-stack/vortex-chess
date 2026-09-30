export class AnalysisResult {
  constructor(
    readonly bestMove: string,
    readonly evaluation: string,
    readonly depth: number,
    readonly correlationId: string,
    readonly isHumanized = false,
  ) {}

  static empty(): AnalysisResult {
    return new AnalysisResult("", "", 0, "", false)
  }
}
