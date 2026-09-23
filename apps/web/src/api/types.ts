import type { components } from './schema'

/** Nomes curtos para os DTOs do contrato. A fonte é sempre o schema gerado — nada é redeclarado. */
type Schemas = components['schemas']

export type Session = Schemas['SessionDto']
export type Registration = Schemas['RegistrationDto']
export type SeriesListItem = Schemas['SeriesListItemDto']
export type SeriesDetail = Schemas['SeriesDetailDto']
export type Season = Schemas['SeasonDto']
export type Episode = Schemas['EpisodeDto']
export type EpisodeRef = Schemas['EpisodeRefDto']
export type NextUpItem = Schemas['NextUpItemDto']
export type Premiere = Schemas['PremiereDto']
export type RewatchSession = Schemas['RewatchSessionDto']
export type SearchResult = Schemas['SeriesSearchResultDto']
export type AddSeriesResult = Schemas['AddSeriesResultDto']
export type WatchState = Schemas['WatchStateDto']
export type TrackingChange = Schemas['TrackingChange']
export type StatsOverview = Schemas['StatsOverviewDto']
export type CalendarDay = Schemas['CalendarDayDto']
export type TimeBucket = Schemas['TimeBucketDto']
export type TopSeries = Schemas['TopSeriesDto']
export type Profile = Schemas['ProfileDto']
