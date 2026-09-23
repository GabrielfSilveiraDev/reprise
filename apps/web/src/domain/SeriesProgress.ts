/** Os números que a API manda sobre o progresso de uma série (lista e detalhe têm os mesmos). */
export interface ProgressNumbers {
  episodesTotal: number
  episodesAired: number
  episodesWatched: number
  productionStatus: string | null
}

export type ProgressPhase =
  /** O catálogo não tem episódio nenhum — série ainda sem metadados. */
  | 'no-catalog'
  | 'not-started'
  /** Há episódio lançado esperando. */
  | 'behind'
  /** Viu tudo o que saiu, e a série continua. */
  | 'caught-up'
  /** Viu tudo, e a produção acabou. */
  | 'complete'

/**
 * Leitura dos números de progresso. Especiais já vêm fora das contagens do servidor.
 *
 * A distinção que importa é entre "falta assistir" (backlog: lançado e não visto) e
 * "falta lançar" (upcoming). Usar só o total faria toda série com temporada anunciada
 * parecer atrasada.
 */
export class SeriesProgress {
  static readonly ENDED = new Set(['Ended', 'Canceled'])

  constructor(private readonly n: ProgressNumbers) {}

  get total(): number {
    return this.n.episodesTotal
  }

  get watched(): number {
    return this.n.episodesWatched
  }

  /** Lançados e ainda não vistos. */
  get backlog(): number {
    return Math.max(0, this.n.episodesAired - this.n.episodesWatched)
  }

  /** Anunciados e ainda não lançados. */
  get upcoming(): number {
    return Math.max(0, this.n.episodesTotal - this.n.episodesAired)
  }

  /** Fração vista do total — a régua não encolhe quando uma temporada nova é anunciada. */
  get ratio(): number {
    return this.n.episodesTotal === 0 ? 0 : Math.min(1, this.n.episodesWatched / this.n.episodesTotal)
  }

  get productionEnded(): boolean {
    return this.n.productionStatus !== null && SeriesProgress.ENDED.has(this.n.productionStatus)
  }

  get phase(): ProgressPhase {
    if (this.n.episodesTotal === 0) return 'no-catalog'
    if (this.n.episodesWatched === 0) return 'not-started'
    if (this.backlog > 0) return 'behind'
    if (this.productionEnded && this.upcoming === 0) return 'complete'
    return 'caught-up'
  }

  /** Frase curta para cartões: "faltam 12", "em dia", "completa". */
  get summary(): string {
    switch (this.phase) {
      case 'no-catalog':
        return 'sem catálogo'
      case 'not-started':
        return this.n.episodesAired === 0 ? 'ainda não estreou' : `${this.n.episodesAired} para começar`
      case 'behind':
        return this.backlog === 1 ? 'falta 1' : `faltam ${this.backlog}`
      case 'caught-up':
        return this.upcoming > 0 ? `em dia · ${this.upcoming} a caminho` : 'em dia'
      case 'complete':
        return 'completa'
    }
  }
}
