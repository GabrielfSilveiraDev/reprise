import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRepriseClient } from '@reprise/shared';
import type {
  CalendarDayDto,
  NextUpItem,
  SeriesDetail,
  SeriesListItem,
  StatsOverviewDto,
} from '@reprise/shared';

export type StatsOverview = StatsOverviewDto;
export type CalendarDay = CalendarDayDto;

// Em dev o Vite faz proxy de /api para a API; em produção a var de ambiente aponta direto.
const client = createRepriseClient(import.meta.env.VITE_API_URL ?? '/api');

export const keys = {
  series: ['series'] as const,
  seriesDetail: (id: number) => ['series', id] as const,
  nextUp: ['next-up'] as const,
  stats: (includeBackfill: boolean) => ['stats', includeBackfill] as const,
  calendar: (year: number, includeBackfill: boolean) => ['calendar', year, includeBackfill] as const,
};

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) throw new Error(String(result.error));
  if (result.data === undefined) throw new Error('Resposta vazia da API.');
  return result.data;
}

export function useSeriesList() {
  return useQuery({
    queryKey: keys.series,
    queryFn: async (): Promise<SeriesListItem[]> => unwrap(await client.GET('/series')),
  });
}

export function useSeriesDetail(id: number) {
  return useQuery({
    queryKey: keys.seriesDetail(id),
    queryFn: async (): Promise<SeriesDetail> =>
      unwrap(await client.GET('/series/{id}', { params: { path: { id } } })),
  });
}

export function useNextUp() {
  return useQuery({
    queryKey: keys.nextUp,
    queryFn: async (): Promise<NextUpItem[]> => unwrap(await client.GET('/next-up')),
  });
}

/**
 * Toda marcação invalida a série e as listas: o progresso, o "próximo a assistir" e as
 * contagens de rewatch são DERIVADOS do log de eventos, então quem manda é sempre o servidor.
 * Nada de espelhar o estado no cliente e torcer para não divergir.
 */
function useInvalidateAfterMark(seriesId?: number) {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.series }),
      qc.invalidateQueries({ queryKey: keys.nextUp }),
      seriesId ? qc.invalidateQueries({ queryKey: keys.seriesDetail(seriesId) }) : Promise.resolve(),
    ]);
  };
}

export function useMarkEpisode(seriesId?: number) {
  const invalidate = useInvalidateAfterMark(seriesId);
  return useMutation({
    mutationFn: async (episodeId: number) =>
      unwrap(
        await client.POST('/episodes/{id}/watch', {
          params: { path: { id: episodeId } },
          body: { watchedAt: null },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useUnmarkEpisode(seriesId?: number) {
  const invalidate = useInvalidateAfterMark(seriesId);
  return useMutation({
    mutationFn: async (episodeId: number) =>
      unwrap(
        await client.DELETE('/episodes/{id}/watch', { params: { path: { id: episodeId } } }),
      ),
    onSuccess: invalidate,
  });
}

export function useMarkSeason(seriesId: number) {
  const invalidate = useInvalidateAfterMark(seriesId);
  return useMutation({
    mutationFn: async (seasonNumber: number) =>
      unwrap(
        await client.POST('/series/{id}/seasons/{seasonNumber}/watch', {
          params: { path: { id: seriesId, seasonNumber } },
          body: { watchedAt: null },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useMarkUpTo(seriesId: number) {
  const invalidate = useInvalidateAfterMark(seriesId);
  return useMutation({
    mutationFn: async (target: { seasonNumber: number; episodeNumber: number }) =>
      unwrap(
        await client.POST('/series/{id}/watch-up-to', {
          params: { path: { id: seriesId } },
          body: { ...target, watchedAt: null },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useStatsOverview(includeBackfill: boolean) {
  return useQuery({
    queryKey: keys.stats(includeBackfill),
    queryFn: async (): Promise<StatsOverview> =>
      unwrap(await client.GET('/stats/overview', { params: { query: { includeBackfill } } })),
  });
}

export function useCalendar(year: number, includeBackfill: boolean) {
  return useQuery({
    queryKey: keys.calendar(year, includeBackfill),
    queryFn: async (): Promise<CalendarDay[]> =>
      unwrap(await client.GET('/stats/calendar', { params: { query: { year, includeBackfill } } })),
  });
}
