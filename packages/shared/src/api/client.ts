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
export interface RepriseClientOptions {
  /** Token do cadeado de acesso da instância (ver `AccessTokenGate` no servidor). */
  readonly gateToken?: string | null;
  /** JWT do usuário autenticado. */
  readonly bearerToken?: string | null;
}

export function createRepriseClient(baseUrl: string, options: RepriseClientOptions = {}) {
  const headers: Record<string, string> = {};
  if (options.gateToken) headers[ACCESS_TOKEN_HEADER] = options.gateToken;
  if (options.bearerToken) headers.Authorization = `Bearer ${options.bearerToken}`;

  return createClient<paths>({
    baseUrl,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
}

export type RepriseClient = ReturnType<typeof createRepriseClient>;

/** Apelidos para os schemas gerados — o resto do código não deve conhecer `components['schemas']`. */
type Schemas = components['schemas'];

export type SeriesListItem = Schemas['SeriesListItemDto'];
export type SeriesDetail = Schemas['SeriesDetailDto'];
/** Um resultado da busca no TMDB. `seriesId` preenchido = a série já existe no acervo local. */
export type SeriesSearchResult = Schemas['SeriesSearchResultDto'];
export type AddSeriesResult = Schemas['AddSeriesResultDto'];
export type Season = Schemas['SeasonDto'];
export type Episode = Schemas['EpisodeDto'];
export type EpisodeRef = Schemas['EpisodeRefDto'];
export type NextUpItem = Schemas['NextUpItemDto'];
export type WatchState = Schemas['WatchStateDto'];
export type BulkMarkResult = Schemas['BulkMarkResult'];
export type Profile = Schemas['ProfileDto'];
export type Premiere = Schemas['PremiereDto'];
export type RewatchSession = Schemas['RewatchSessionDto'];
export type ExportDocument = Schemas['ExportDocument'];

export type StatsOverviewDto = Schemas['StatsOverviewDto'];
export type StatsSummaryDto = Schemas['StatsSummaryDto'];
export type TimeBucketDto = Schemas['TimeBucketDto'];
export type TopSeriesDto = Schemas['TopSeriesDto'];
export type CalendarDayDto = Schemas['CalendarDayDto'];
export type StreaksDto = Schemas['StreaksDto'];

/** Estados possíveis de uma série para o usuário. O servidor manda como string. */
export const SERIES_STATUSES = ['Following', 'Archived', 'ForLater', 'Finished'] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];
