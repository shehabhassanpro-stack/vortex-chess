export interface SanMove {
  san: string
  raw: string
}

export interface IMoveListReader {
  findContainer(): Element | null
  extractMoves(container: Element): SanMove[]
}
