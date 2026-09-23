import type { Episode, NextUpItem, Premiere, Season, SeriesDetail, SeriesListItem } from '@/api/types'

/** Construtores de DTO para teste: o mínimo válido, com o que interessa sobrescrito. */
export class Make {
  private static seq = 1

  static episode(overrides: Partial<Episode> = {}): Episode {
    const id = overrides.id ?? Make.seq++
    return {
      id,
      seasonNumber: 1,
      episodeNumber: 1,
      name: `Episódio ${id}`,
      runtimeSeconds: 2700,
      isSpecial: false,
      watchCount: 0,
      lastWatchedAt: null,
      stillPath: null,
      overview: null,
      airDate: '2020-01-01',
      releasesAt: '2020-01-02T08:00:00Z',
      ...overrides,
    }
  }

  static season(seasonNumber: number, episodes: Partial<Episode>[]): Season {
    return {
      seasonNumber,
      name: null,
      isSpecials: seasonNumber === 0,
      episodes: episodes.map((e, i) =>
        Make.episode({ seasonNumber, episodeNumber: i + 1, isSpecial: seasonNumber === 0, ...e }),
      ),
    }
  }

  static detail(seasons: Season[], overrides: Partial<SeriesDetail> = {}): SeriesDetail {
    return {
      id: 1,
      tvdbId: null,
      name: 'Série',
      originalName: null,
      overview: null,
      posterPath: null,
      status: 'Following',
      productionStatus: 'Returning Series',
      firstAirDate: '2020-01-01',
      episodesTotal: 0,
      episodesAired: 0,
      episodesWatched: 0,
      completionRatio: 0,
      seasons,
      sessions: [],
      backfillExhibitions: 0,
      ...overrides,
    }
  }

  static seriesItem(overrides: Partial<SeriesListItem> = {}): SeriesListItem {
    return {
      id: Make.seq++,
      tvdbId: null,
      name: 'Série',
      posterPath: null,
      status: 'Following',
      productionStatus: 'Returning Series',
      episodesTotal: 10,
      episodesAired: 10,
      episodesWatched: 5,
      completionRatio: 0.5,
      lastWatchedAt: null,
      nextUp: null,
      ...overrides,
    }
  }

  static premiere(overrides: Partial<Premiere> = {}): Premiere {
    return {
      episodeId: Make.seq++,
      seriesId: 1,
      seriesName: 'Série',
      posterPath: null,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeName: null,
      stillPath: null,
      airDate: '2026-09-25',
      releasesAt: '2026-09-25T07:00:00Z',
      isSeasonPremiere: false,
      overview: null,
      lastActivityAt: null,
      ...overrides,
    }
  }

  static nextUp(overrides: Partial<NextUpItem> = {}): NextUpItem {
    return {
      seriesId: Make.seq++,
      seriesName: 'Série',
      posterPath: null,
      episode: { id: Make.seq++, seasonNumber: 1, episodeNumber: 1, name: null },
      lastActivityAt: null,
      ...overrides,
    }
  }
}
