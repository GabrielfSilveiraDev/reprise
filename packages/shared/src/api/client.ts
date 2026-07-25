import createClient from 'openapi-fetch';
import type { components, paths } from './schema.ts';

/**
 * Cabeçalho do cadeado de acesso da API (ver `AccessTokenGate` no servidor). Só é exigido
 * quando a API está configurada com um token — em casa, na LAN, não vai nada aqui.
 */
export const ACCESS_TOKEN_HEADER = 'X-Reprise-Token';

/**
 * Cliente tipado da API, gerado a partir do OpenAPI que a própria API publica.
 * Nada de tipos escritos à mão que silenciosamente desalinham do servidor: rode
 * `pnpm --filter @reprise/shared generate` depois de mexer nos endpoints.
 */
export function createRepriseClient(baseUrl: string, accessToken?: string | null) {
  return createClient<paths>({
    baseUrl,
    headers: accessToken ? { [ACCESS_TOKEN_HEADER]: accessToken } : undefined,
  });
}

export type RepriseClient = ReturnType<typeof createRepriseClient>;

/** Apelidos para os schemas gerados — o resto do código não deve conhecer `components['schemas']`. */
type Schemas = components['schemas'];

export type SeriesListItem = Schemas['SeriesListItemDto'];
export type SeriesDetail = Schemas['SeriesDetailDto'];
export type Season = Schemas['SeasonDto'];
export type Episode = Schemas['EpisodeDto'];
export type EpisodeRef = Schemas['EpisodeRefDto'];
export type NextUpItem = Schemas['NextUpItemDto'];
export type WatchState = Schemas['WatchStateDto'];
export type BulkMarkResult = Schemas['BulkMarkResult'];
export type Profile = Schemas['ProfileDto'];

export type StatsOverviewDto = Schemas['StatsOverviewDto'];
export type StatsSummaryDto = Schemas['StatsSummaryDto'];
export type TimeBucketDto = Schemas['TimeBucketDto'];
export type TopSeriesDto = Schemas['TopSeriesDto'];
export type CalendarDayDto = Schemas['CalendarDayDto'];
export type StreaksDto = Schemas['StreaksDto'];

/** Estados possíveis de uma série para o usuário. O servidor manda como string. */
export const SERIES_STATUSES = ['Following', 'Archived', 'ForLater', 'Finished'] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];
