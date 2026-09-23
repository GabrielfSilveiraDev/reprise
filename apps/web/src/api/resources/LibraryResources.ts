import type { TrackingStatus } from '@/domain/TrackingStatus'
import type {
  AddSeriesResult,
  CalendarDay,
  NextUpItem,
  Premiere,
  Profile,
  SearchResult,
  SeriesDetail,
  SeriesListItem,
  StatsOverview,
  TrackingChange,
  WatchState,
} from '../types'
import { ClientKey, Resource } from './Resource'

/** O acervo: séries acompanhadas, detalhe, busca no TMDB e estado de acompanhamento. */
export class SeriesResource extends Resource {
  list(): Promise<SeriesListItem[]> {
    return this.call(this.http.GET('/series'))
  }

  detail(id: number): Promise<SeriesDetail> {
    return this.call(this.http.GET('/series/{id}', { params: { path: { id } } }))
  }

  nextUp(): Promise<NextUpItem[]> {
    return this.call(this.http.GET('/next-up'))
  }

  search(q: string): Promise<SearchResult[]> {
    return this.call(this.http.GET('/series/search', { params: { query: { q } } }))
  }

  add(tmdbId: number): Promise<AddSeriesResult> {
    return this.call(this.http.POST('/series', { body: { tmdbId } }))
  }

  async setStatus(id: number, status: TrackingStatus): Promise<void> {
    await this.call(this.http.PATCH('/series/{id}/status', { params: { path: { id } }, body: { status } }))
  }

  async setStatuses(changes: TrackingChange[]): Promise<void> {
    await this.call(this.http.PATCH('/series/status', { body: changes }))
  }

  /** Tira a revisão da fila de próximos — até a próxima exibição repetida, que a traz de volta. */
  async dismissRewatch(id: number): Promise<void> {
    await this.call(this.http.PUT('/series/{id}/rewatch/dismissal', { params: { path: { id } } }))
  }

  /** Desfaz {@link dismissRewatch}. */
  async restoreRewatch(id: number): Promise<void> {
    await this.call(this.http.DELETE('/series/{id}/rewatch/dismissal', { params: { path: { id } } }))
  }
}

/**
 * Marcações. Cada chamada leva uma chave de idempotência nova: repetir a MESMA chamada (retentativa)
 * não cria evento; chamar de novo (outro clique) cria — é um rewatch, e isso é o modelo.
 */
export class WatchingResource extends Resource {
  mark(episodeId: number, watchedAt?: Date): Promise<WatchState> {
    return this.call(
      this.http.POST('/episodes/{id}/watch', {
        params: { path: { id: episodeId } },
        body: { watchedAt: watchedAt?.toISOString() ?? null, clientKey: ClientKey.create() },
      }),
    )
  }

  unmark(episodeId: number): Promise<WatchState> {
    return this.call(
      this.http.DELETE('/episodes/{id}/watch', {
        params: { path: { id: episodeId }, query: { clientKey: ClientKey.create() } },
      }),
    )
  }

  async markSeason(seriesId: number, seasonNumber: number): Promise<number> {
    const result = await this.call(
      this.http.POST('/series/{id}/seasons/{seasonNumber}/watch', {
        params: { path: { id: seriesId, seasonNumber } },
        body: { watchedAt: null, clientKey: ClientKey.create() },
      }),
    )
    return result.marked
  }

  async markUpTo(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<number> {
    const result = await this.call(
      this.http.POST('/series/{id}/watch-up-to', {
        params: { path: { id: seriesId } },
        body: { seasonNumber, episodeNumber, watchedAt: null, clientKey: ClientKey.create() },
      }),
    )
    return result.marked
  }
}

export class ScheduleResource extends Resource {
  premieres(withinDays?: number): Promise<Premiere[]> {
    return this.call(this.http.GET('/premieres', { params: { query: withinDays ? { withinDays } : {} } }))
  }
}

export class StatsResource extends Resource {
  overview(includeBackfill: boolean): Promise<StatsOverview> {
    return this.call(this.http.GET('/stats/overview', { params: { query: { includeBackfill } } }))
  }

  calendar(year: number, includeBackfill: boolean): Promise<CalendarDay[]> {
    return this.call(this.http.GET('/stats/calendar', { params: { query: { year, includeBackfill } } }))
  }
}

export interface ExportFile {
  blob: Blob
  filename: string
}

export class AccountResource extends Resource {
  me(): Promise<Profile> {
    return this.call(this.http.GET('/me'))
  }

  /** O export completo, como arquivo. O nome vem do servidor (com a data), com um plano B local. */
  async export(): Promise<ExportFile> {
    const request = this.http.GET('/export', { parseAs: 'blob' })
    const blob = (await this.call(request)) as unknown as Blob
    const { response } = await request
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `reprise-${new Date().toISOString().slice(0, 10)}.json`
    return { blob, filename }
  }
}
