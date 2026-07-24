import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

/**
 * Cliente tipado da API, gerado a partir do OpenAPI que a própria API publica.
 * Nada de tipos escritos à mão que silenciosamente desalinham do servidor: rode
 * `pnpm --filter @reprise/shared generate` depois de mexer nos endpoints.
 */
export function createRepriseClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
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

/** Estados possíveis de uma série para o usuário. O servidor manda como string. */
export const SERIES_STATUSES = ['Following', 'Archived', 'ForLater', 'Finished'] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];
