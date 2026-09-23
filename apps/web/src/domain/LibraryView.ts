import type { SeriesListItem } from '@/api/types'
import { SeriesProgress } from './SeriesProgress'
import { TRACKING_STATUSES, type TrackingStatus } from './TrackingStatus'

export const LIBRARY_FILTERS = [...TRACKING_STATUSES, 'todas'] as const
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number]

export const LIBRARY_SORTS = ['atividade', 'pendentes', 'progresso', 'nome'] as const
export type LibrarySort = (typeof LIBRARY_SORTS)[number]

export interface LibraryQuery {
  filter: LibraryFilter
  sort: LibrarySort
  text: string
}

/** Filtro, busca e ordenação do acervo — tudo no cliente, porque a lista inteira já veio. */
export class LibraryView {
  constructor(private readonly series: readonly SeriesListItem[]) {}

  counts(): Record<LibraryFilter, number> {
    const counts = { Following: 0, ForLater: 0, Finished: 0, Archived: 0, todas: this.series.length }
    for (const s of this.series) {
      if (s.status in counts) counts[s.status as TrackingStatus] += 1
    }
    return counts
  }

  apply(query: LibraryQuery): SeriesListItem[] {
    const needle = LibraryView.fold(query.text)
    return this.series
      .filter((s) => query.filter === 'todas' || s.status === query.filter)
      .filter((s) => !needle || LibraryView.fold(s.name).includes(needle))
      .sort(LibraryView.comparator(query.sort))
  }

  /** Busca sem acento e sem caixa: "pokemon" acha "Pokémon". */
  static fold(text: string): string {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  }

  private static comparator(sort: LibrarySort): (a: SeriesListItem, b: SeriesListItem) => number {
    const byName = (a: SeriesListItem, b: SeriesListItem) => a.name.localeCompare(b.name, 'pt-BR')
    const lastWatched = (s: SeriesListItem) => (s.lastWatchedAt ? Date.parse(s.lastWatchedAt) : 0)
    switch (sort) {
      case 'nome':
        return byName
      case 'pendentes':
        return (a, b) => new SeriesProgress(b).backlog - new SeriesProgress(a).backlog || byName(a, b)
      case 'progresso':
        return (a, b) => new SeriesProgress(b).ratio - new SeriesProgress(a).ratio || byName(a, b)
      case 'atividade':
        return (a, b) => lastWatched(b) - lastWatched(a) || byName(a, b)
    }
  }
}
