import type { Episode, Season, SeriesDetail } from '@/api/types'
import { EpisodeCode } from './EpisodeCode'
import type { HeatLevel } from './HeatmapYear'
import { ReleaseClock } from './ReleaseClock'

export type CellState = 'watched' | 'unwatched' | 'upcoming'

export interface MapCell {
  episode: Episode
  code: EpisodeCode
  state: CellState
  /** Quantas vezes, na escala de calor: 1, 2, 3, 4+. */
  level: HeatLevel
  isNext: boolean
}

export interface MapRow {
  season: Season
  label: string
  cells: MapCell[]
  watched: number
  released: number
  total: number
  /** Lançados e não vistos — o que "marcar temporada" marcaria. */
  pending: number
}

/**
 * A série inteira como uma grade: uma linha por temporada, uma célula por episódio, a cor dizendo
 * quantas vezes cada um foi visto. É a imagem do princípio do Reprise — exibição é evento, e
 * rever um episódio o deixa mais quente, não "mais marcado".
 */
export class EpisodeMap {
  readonly rows: MapRow[]
  readonly nextUp: Episode | null
  readonly maxWatchCount: number

  constructor(detail: SeriesDetail, clock: ReleaseClock = new ReleaseClock()) {
    let next: Episode | null = null
    let max = 0

    this.rows = detail.seasons.map((season) => {
      const cells = season.episodes.map((episode): MapCell => {
        const released = clock.isReleased(episode)
        const state: CellState = episode.watchCount > 0 ? 'watched' : released ? 'unwatched' : 'upcoming'
        max = Math.max(max, episode.watchCount)
        // Mesma regra do servidor para "próximo": o primeiro regular não visto e já lançado,
        // na ordem — inclusive o buraco no meio, e não o seguinte ao último visto.
        const isNext = !next && !season.isSpecials && state === 'unwatched'
        if (isNext) next = episode
        return { episode, code: EpisodeCode.of(episode), state, level: EpisodeMap.level(episode.watchCount), isNext }
      })

      const watched = cells.filter((c) => c.state === 'watched').length
      const released = cells.filter((c) => c.state !== 'upcoming').length
      return {
        season,
        label: season.isSpecials ? 'Esp.' : `T${season.seasonNumber}`,
        cells,
        watched,
        released,
        total: cells.length,
        pending: cells.filter((c) => c.state === 'unwatched').length,
      }
    })

    this.nextUp = next
    this.maxWatchCount = max
  }

  static level(watchCount: number): HeatLevel {
    return Math.min(4, Math.max(0, watchCount)) as HeatLevel
  }

  row(seasonNumber: number): MapRow | undefined {
    return this.rows.find((r) => r.season.seasonNumber === seasonNumber)
  }

  /** A temporada para abrir primeiro: a do próximo episódio, senão a última com algo visto, senão a primeira. */
  defaultSeason(): number | null {
    if (this.nextUp) return this.nextUp.seasonNumber
    const regular = this.rows.filter((r) => !r.season.isSpecials)
    const lastWatched = [...regular].reverse().find((r) => r.watched > 0)
    return (lastWatched ?? regular[0] ?? this.rows[0])?.season.seasonNumber ?? null
  }

  /** Episódios regulares lançados e não vistos até (e incluindo) o alvo — o que "marcar até aqui" cria. */
  pendingUpTo(target: Episode): number {
    let count = 0
    for (const row of this.rows) {
      if (row.season.isSpecials) continue
      for (const cell of row.cells) {
        const before =
          cell.episode.seasonNumber < target.seasonNumber ||
          (cell.episode.seasonNumber === target.seasonNumber && cell.episode.episodeNumber <= target.episodeNumber)
        if (before && cell.state === 'unwatched') count += 1
      }
    }
    return count
  }
}
