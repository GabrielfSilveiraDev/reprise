import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRepriseClient } from '@reprise/shared';
import { Auth } from './auth';
import { WebSession } from './session';
import type {
  AddSeriesResult,
  CalendarDayDto,
  NextUpItem,
  Premiere,
  Profile,
  SeriesDetail,
  SeriesListItem,
  SeriesSearchResult,
  StatsOverviewDto,
} from '@reprise/shared';

export type StatsOverview = StatsOverviewDto;
export type CalendarDay = CalendarDayDto;

// Em dev o Vite faz proxy de /api para a API; em produção a var de ambiente aponta direto.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Um cliente por requisição, com o token do momento.
 *
 * Renova ANTES de usar quando o acesso está por vencer, em vez de esperar o 401 e repetir: uma
 * marcação repetida seria uma exibição a mais no log, e o log é a fonte da verdade deste app.
 */
async function client() {
  let session = WebSession.read();
  if (session && WebSession.isExpired(session)) session = await Auth.refresh();
  return createRepriseClient(BASE_URL, { bearerToken: session?.accessToken });
}

export const keys = {
  series: ['series'] as const,
  seriesDetail: (id: number) => ['series', id] as const,
  search: (term: string) => ['series-search', term] as const,
  nextUp: ['next-up'] as const,
  premieres: ['premieres'] as const,
  profile: ['me'] as const,
  stats: (includeBackfill: boolean) => ['stats', includeBackfill] as const,
  calendar: (year: number, includeBackfill: boolean) => ['calendar', year, includeBackfill] as const,
};

/**
 * O corpo de erro da API, no formato ProblemDetails do ASP.NET.
 *
 * A mensagem importa: `String(objeto)` devolve `[object Object]`, e era isso que chegava à tela
 * quando a API recusava uma marcação com um motivo escrito por extenso. Um erro que não diz o que
 * houve é o mesmo que um erro sem tratamento.
 */
function mensagemDoErro(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const problem = error as { detail?: unknown; title?: unknown };
    if (typeof problem.detail === 'string' && problem.detail) return problem.detail;
    if (typeof problem.title === 'string' && problem.title) return problem.title;
  }

  return 'A API recusou a operação.';
}

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) throw new Error(mensagemDoErro(result.error));
  if (result.data === undefined) throw new Error('Resposta vazia da API.');
  return result.data;
}

export function useSeriesList() {
  return useQuery({
    queryKey: keys.series,
    queryFn: async (): Promise<SeriesListItem[]> => unwrap(await (await client()).GET('/series')),
  });
}

export function useSeriesDetail(id: number) {
  return useQuery({
    queryKey: keys.seriesDetail(id),
    queryFn: async (): Promise<SeriesDetail> =>
      unwrap(await (await client()).GET('/series/{id}', { params: { path: { id } } })),
  });
}

/**
 * Busca no TMDB, para achar série que nunca esteve no export.
 *
 * `staleTime` alto de propósito: o resultado de "severance" não muda entre um minuto e outro, e
 * cada busca custa DUAS requisições ao TMDB no servidor (uma pelos textos em português, outra pelo
 * pôster em inglês). Reconsultar a cada foco na janela seria pagar isso à toa.
 *
 * Quem chama passa o termo já com atraso — ver `useDebounced` na página. Sem isso seria uma busca
 * por tecla digitada.
 */
export function useSeriesSearch(term: string) {
  const termo = term.trim();
  return useQuery({
    queryKey: keys.search(termo),
    queryFn: async (): Promise<SeriesSearchResult[]> =>
      unwrap(await (await client()).GET('/series/search', { params: { query: { q: termo } } })),
    // O servidor recusa menos de 2 caracteres; não faz sentido perguntar para levar 400.
    enabled: termo.length >= 2,
    staleTime: 5 * 60_000,
    /*
     * `always` e não o padrão `online`.
     *
     * No modo padrão o react-query PAUSA a tentativa quando julga não haver rede, e uma query
     * pausada fica em `pending` para sempre: a tela mostra "Carregando…" indefinidamente, sem erro
     * e sem resultado. Foi exatamente o que apareceu aqui quando a API respondeu 503 por falta de
     * chave do TMDB — o retry pausou e a mensagem nunca chegou à tela.
     *
     * Para uma busca isso é o pior comportamento possível. Ela depende de um serviço externo e não
     * tem resposta em cache para oferecer: ou responde, ou falhou. Falhar em voz alta é o que
     * permite à tela dizer o motivo.
     */
    networkMode: 'always',
    // Um 400 (termo curto) ou 503 (sem chave) não melhora na segunda tentativa; só atrasa a
    // mensagem em um segundo.
    retry: false,
  });
}

/**
 * Adiciona a série ao acervo e passa a acompanhá-la.
 *
 * Invalida também a busca: o resultado carrega o "você já tem esta", e deixá-lo velho faria o
 * botão continuar oferecendo adicionar o que acabou de entrar.
 */
export function useAddSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tmdbId: number): Promise<AddSeriesResult> =>
      unwrap(await (await client()).POST('/series', { body: { tmdbId } })),
    // Mesma razão da busca: sem isto o botão ficaria em "Adicionando…" para sempre quando a
    // requisição falhasse, em vez de mostrar o motivo ao lado dele.
    networkMode: 'always',
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.series }),
        qc.invalidateQueries({ queryKey: keys.nextUp }),
        qc.invalidateQueries({ queryKey: ['series-search'] }),
      ]);
    },
  });
}

export function useNextUp() {
  return useQuery({
    queryKey: keys.nextUp,
    queryFn: async (): Promise<NextUpItem[]> => unwrap(await (await client()).GET('/next-up')),
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
        await (await client()).POST('/episodes/{id}/watch', {
          params: { path: { id: episodeId } },
          body: { watchedAt: null, clientKey: null },
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
        await (await client()).DELETE('/episodes/{id}/watch', { params: { path: { id: episodeId } } }),
      ),
    onSuccess: invalidate,
  });
}

export function useMarkSeason(seriesId: number) {
  const invalidate = useInvalidateAfterMark(seriesId);
  return useMutation({
    mutationFn: async (seasonNumber: number) =>
      unwrap(
        await (await client()).POST('/series/{id}/seasons/{seasonNumber}/watch', {
          params: { path: { id: seriesId, seasonNumber } },
          body: { watchedAt: null, clientKey: null },
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
        await (await client()).POST('/series/{id}/watch-up-to', {
          params: { path: { id: seriesId } },
          // `clientKey` é a chave de idempotência do app offline; o web marca online e não precisa.
          body: { ...target, watchedAt: null, clientKey: null },
        }),
      ),
    onSuccess: invalidate,
  });
}

/**
 * Muda o estado de acompanhamento. Existia só no app: pelo web não havia como arquivar nada.
 * Não toca no log de exibições — arquivar não apaga histórico.
 */
export function useSetSeriesStatus(seriesId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) =>
      unwrap(
        await (await client()).PATCH('/series/{id}/status', {
          params: { path: { id: seriesId } },
          body: { status },
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.series }),
        qc.invalidateQueries({ queryKey: keys.seriesDetail(seriesId) }),
        qc.invalidateQueries({ queryKey: keys.nextUp }),
      ]);
    },
  });
}

/** O que ainda vai ao ar nas séries acompanhadas. Existia só no app. */
export function usePremieres() {
  return useQuery({
    queryKey: keys.premieres,
    queryFn: async (): Promise<Premiere[]> => unwrap(await (await client()).GET('/premieres')),
  });
}

/** Identidade e tamanho do acervo. Existia só no app. */
export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async (): Promise<Profile> => unwrap(await (await client()).GET('/me')),
  });
}

export function useStatsOverview(includeBackfill: boolean) {
  return useQuery({
    queryKey: keys.stats(includeBackfill),
    queryFn: async (): Promise<StatsOverview> =>
      unwrap(await (await client()).GET('/stats/overview', { params: { query: { includeBackfill } } })),
  });
}

export function useCalendar(year: number, includeBackfill: boolean) {
  return useQuery({
    queryKey: keys.calendar(year, includeBackfill),
    queryFn: async (): Promise<CalendarDay[]> =>
      unwrap(await (await client()).GET('/stats/calendar', { params: { query: { year, includeBackfill } } })),
  });
}
