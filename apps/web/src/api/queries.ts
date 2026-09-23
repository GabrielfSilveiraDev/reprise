import { queryOptions } from '@tanstack/react-query'
import { ApiError } from './ApiError'
import { api } from './RepriseApi'

/**
 * Todas as consultas num lugar: chave + função, prontas para `useQuery`, para os loaders do
 * roteador (pré-busca ao passar o mouse num link) e para invalidar com precisão depois de marcar.
 */
export class Queries {
  static readonly keys = {
    seriesList: ['series', 'list'] as const,
    seriesDetail: (id: number) => ['series', 'detail', id] as const,
    nextUp: ['next-up'] as const,
    premieres: ['premieres'] as const,
    stats: ['stats'] as const,
    me: ['me'] as const,
    search: (q: string) => ['search', q] as const,
  }

  static seriesList() {
    return queryOptions({ queryKey: Queries.keys.seriesList, queryFn: () => api.series.list() })
  }

  static seriesDetail(id: number) {
    return queryOptions({ queryKey: Queries.keys.seriesDetail(id), queryFn: () => api.series.detail(id) })
  }

  static nextUp() {
    return queryOptions({ queryKey: Queries.keys.nextUp, queryFn: () => api.series.nextUp() })
  }

  static premieres() {
    return queryOptions({ queryKey: Queries.keys.premieres, queryFn: () => api.schedule.premieres(), staleTime: 5 * 60_000 })
  }

  static statsOverview(includeBackfill: boolean) {
    return queryOptions({
      queryKey: [...Queries.keys.stats, 'overview', includeBackfill] as const,
      queryFn: () => api.stats.overview(includeBackfill),
    })
  }

  static statsCalendar(year: number, includeBackfill: boolean) {
    return queryOptions({
      queryKey: [...Queries.keys.stats, 'calendar', year, includeBackfill] as const,
      queryFn: () => api.stats.calendar(year, includeBackfill),
    })
  }

  static me() {
    return queryOptions({ queryKey: Queries.keys.me, queryFn: () => api.account.me() })
  }

  static search(q: string) {
    return queryOptions({
      queryKey: Queries.keys.search(q),
      queryFn: () => api.series.search(q),
      enabled: q.trim().length >= 2,
      staleTime: 5 * 60_000,
      // 503 = servidor sem chave do TMDB. Tentar de novo não muda nada.
      retry: (count, error) => !(error instanceof ApiError && error.isUnavailable) && count < 1,
    })
  }
}
