/** Coordenada de um episódio — "S02E05". A temporada 0 é a dos especiais. */
export class EpisodeCode {
  constructor(
    readonly season: number,
    readonly episode: number,
  ) {}

  static of(ep: { seasonNumber: number; episodeNumber: number }): EpisodeCode {
    return new EpisodeCode(ep.seasonNumber, ep.episodeNumber)
  }

  get isSpecial(): boolean {
    return this.season === 0
  }

  /** Forma compacta, usada em mono: S02E05. */
  toString(): string {
    return `S${EpisodeCode.pad(this.season)}E${EpisodeCode.pad(this.episode)}`
  }

  /** Forma por extenso, para leitores de tela e rótulos: "Temporada 2, episódio 5". */
  toSpoken(): string {
    return this.isSpecial
      ? `Especial ${this.episode}`
      : `Temporada ${this.season}, episódio ${this.episode}`
  }

  private static pad(n: number): string {
    return String(n).padStart(2, '0')
  }
}
