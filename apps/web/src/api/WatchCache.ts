import type { QueryClient } from '@tanstack/react-query'
import { Queries } from './queries'
import type { SeriesDetail, WatchState } from './types'

/**
 * O cache do React Query visto pelo lado das marcações.
 *
 * Marcar precisa parecer instantâneo — é a ação que se repete dezenas de vezes por semana —,
 * então o detalhe da série é atualizado antes da resposta e corrigido com o estado que o servidor
 * devolve (a contagem real, que é a fonte da verdade). O resto (lista, fila, números) depende de
 * contas que só o servidor faz, e é simplesmente invalidado.
 */
export class WatchCache {
  constructor(private readonly client: QueryClient) {}

  /** Soma `delta` exibições ao episódio no detalhe em cache. Devolve o estado anterior, para desfazer. */
  async bump(seriesId: number, episodeId: number, delta: 1 | -1, at: Date = new Date()): Promise<SeriesDetail | undefined> {
    const key = Queries.keys.seriesDetail(seriesId)
    await this.client.cancelQueries({ queryKey: key })
    const previous = this.client.getQueryData<SeriesDetail>(key)
    if (previous) {
      this.client.setQueryData<SeriesDetail>(key, WatchCache.patch(previous, episodeId, (e) => {
        const watchCount = Math.max(0, e.watchCount + delta)
        return {
          ...e,
          watchCount,
          lastWatchedAt: delta > 0 ? at.toISOString() : watchCount === 0 ? null : e.lastWatchedAt,
        }
      }))
    }
    return previous
  }

  /** Aplica a contagem que o servidor confirmou. */
  settle(seriesId: number, state: WatchState): void {
    const key = Queries.keys.seriesDetail(seriesId)
    const current = this.client.getQueryData<SeriesDetail>(key)
    if (!current) return
    this.client.setQueryData<SeriesDetail>(key, WatchCache.patch(current, state.episodeId, (e) => ({
      ...e,
      watchCount: state.watchCount,
      lastWatchedAt: state.lastWatchedAt,
    })))
  }

  restore(seriesId: number, previous: SeriesDetail | undefined): void {
    if (previous) this.client.setQueryData(Queries.keys.seriesDetail(seriesId), previous)
  }

  /** Tudo o que deriva do log de exibições. */
  invalidateAfterWatch(seriesId: number): Promise<void> {
    return Promise.all([
      this.client.invalidateQueries({ queryKey: Queries.keys.seriesDetail(seriesId) }),
      this.client.invalidateQueries({ queryKey: Queries.keys.seriesList }),
      this.client.invalidateQueries({ queryKey: Queries.keys.nextUp }),
      this.client.invalidateQueries({ queryKey: Queries.keys.premieres }),
      this.client.invalidateQueries({ queryKey: Queries.keys.stats }),
      this.client.invalidateQueries({ queryKey: Queries.keys.me }),
    ]).then(() => undefined)
  }

  /** Tudo o que depende do estado de acompanhamento. */
  invalidateAfterTracking(seriesIds: number[]): Promise<void> {
    return Promise.all([
      ...seriesIds.map((id) => this.client.invalidateQueries({ queryKey: Queries.keys.seriesDetail(id) })),
      this.client.invalidateQueries({ queryKey: Queries.keys.seriesList }),
      this.client.invalidateQueries({ queryKey: Queries.keys.nextUp }),
      this.client.invalidateQueries({ queryKey: Queries.keys.premieres }),
      this.client.invalidateQueries({ queryKey: Queries.keys.me }),
    ]).then(() => undefined)
  }

  private static patch(
    detail: SeriesDetail,
    episodeId: number,
    change: (e: SeriesDetail['seasons'][number]['episodes'][number]) => SeriesDetail['seasons'][number]['episodes'][number],
  ): SeriesDetail {
    let watchedDelta = 0
    const seasons = detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((e) => {
        if (e.id !== episodeId) return e
        const next = change(e)
        if (!season.isSpecials) watchedDelta = Number(next.watchCount > 0) - Number(e.watchCount > 0)
        return next
      }),
    }))
    const episodesWatched = detail.episodesWatched + watchedDelta
    return {
      ...detail,
      seasons,
      episodesWatched,
      completionRatio: detail.episodesTotal ? episodesWatched / detail.episodesTotal : 0,
    }
  }
}
