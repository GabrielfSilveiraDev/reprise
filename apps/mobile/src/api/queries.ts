import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddSeriesResult,
  NextUpItem,
  PendingAction,
  PendingActionDraft,
  Premiere,
  CalendarDayDto,
  Profile,
  SeriesDetail,
  SeriesListItem,
  SeriesSearchResult,
  StatsOverviewDto,
} from '@reprise/shared';
import { openClient } from '@/api/client';
import { SyncEngine } from '@/offline/sync-engine';

/** Uma instância só, criada na primeira necessidade. */
let engine: Promise<SyncEngine> | null = null;
export function syncEngine(): Promise<SyncEngine> {
  engine ??= SyncEngine.open();
  return engine;
}

export const keys = {
  series: ['series'] as const,
  seriesDetail: (id: number) => ['series', id] as const,
  nextUp: ['next-up'] as const,
  profile: ['me'] as const,
  premieres: ['premieres'] as const,
  calendar: (year: number, includeBackfill: boolean) => ['calendar', year, includeBackfill] as const,
  stats: (includeBackfill: boolean) => ['stats', includeBackfill] as const,
  search: (term: string) => ['series-search', term] as const,
  pending: ['pending'] as const,
  deadLetters: ['dead-letters'] as const,
};

/**
 * O corpo de erro da API, no formato ProblemDetails do ASP.NET.
 *
 * `String(objeto)` devolve `[object Object]` — era isso que chegava à tela quando a API recusava
 * uma operação com um motivo escrito por extenso. Um erro que não diz o que houve é o mesmo que
 * um erro sem tratamento, e aqui dói mais do que no web: no celular não há aba de rede para abrir
 * e conferir o que o servidor de fato respondeu.
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

// ── Leitura ────────────────────────────────────────────────────────────────────────────
// `staleTime: 0` de propósito: quem decide o que é fresco é o cache em SQLite, não a memória
// do react-query, que morre junto com o processo. Toda leitura passa por `fetchWithCache`,
// que tenta a rede e cai para o disco quando ela não responde.

export function useSeriesList() {
  return useQuery({
    queryKey: keys.series,
    queryFn: async (): Promise<SeriesListItem[]> => {
      const sync = await syncEngine();
      return sync.fetchWithCache('series', async (c) => unwrap(await c.GET('/series')));
    },
  });
}

export function useSeriesDetail(id: number) {
  return useQuery({
    queryKey: keys.seriesDetail(id),
    queryFn: async (): Promise<SeriesDetail> => {
      const sync = await syncEngine();
      return sync.fetchWithCache(`series/${id}`, async (c) =>
        unwrap(await c.GET('/series/{id}', { params: { path: { id } } })),
      );
    },
  });
}

export function useNextUp() {
  return useQuery({
    queryKey: keys.nextUp,
    queryFn: async (): Promise<NextUpItem[]> => {
      const sync = await syncEngine();
      return sync.fetchWithCache('next-up', async (c) => unwrap(await c.GET('/next-up')));
    },
  });
}

/** O que ainda vai ao ar nas séries acompanhadas. Também em cache: dado de ontem serve. */
export function usePremieres() {
  return useQuery({
    queryKey: keys.premieres,
    queryFn: async (): Promise<Premiere[]> => {
      const sync = await syncEngine();
      return sync.fetchWithCache('premieres', async (c) => unwrap(await c.GET('/premieres')));
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async (): Promise<Profile> => {
      const sync = await syncEngine();
      return sync.fetchWithCache('me', async (c) => unwrap(await c.GET('/me')));
    },
  });
}

/**
 * As estatísticas do servidor. Também passam pelo cache em disco: o painel abre com os números
 * da última sincronização em vez de uma tela vazia quando não há rede.
 */
export function useStatsOverview(includeBackfill: boolean) {
  return useQuery({
    queryKey: keys.stats(includeBackfill),
    queryFn: async (): Promise<StatsOverviewDto> => {
      const sync = await syncEngine();
      return sync.fetchWithCache(`stats/${includeBackfill}`, async (c) =>
        unwrap(await c.GET('/stats/overview', { params: { query: { includeBackfill } } })),
      );
    },
  });
}

/** Exibições por dia de um ano, para o calendário. Só dias com atividade voltam. */
export function useCalendar(year: number, includeBackfill: boolean) {
  return useQuery({
    queryKey: keys.calendar(year, includeBackfill),
    queryFn: async (): Promise<CalendarDayDto[]> => {
      const sync = await syncEngine();
      return sync.fetchWithCache(`calendar/${year}/${includeBackfill}`, async (c) =>
        unwrap(await c.GET('/stats/calendar', { params: { query: { year, includeBackfill } } })),
      );
    },
  });
}

/**
 * Busca no TMDB. É a única leitura do app que NÃO passa pelo cache em disco, e de propósito.
 *
 * O cache existe para o acervo continuar legível no metrô. Uma busca é outra coisa: o resultado
 * depende de um serviço externo, o termo é sempre novo, e guardar uma entrada por texto digitado
 * encheria o SQLite de linhas que ninguém lê duas vezes. Sem rede aqui não há resposta possível —
 * e a tela diz isso em vez de fingir que tem.
 */
export function useSeriesSearch(term: string) {
  const termo = term.trim();
  return useQuery({
    queryKey: keys.search(termo),
    queryFn: async (): Promise<SeriesSearchResult[]> => {
      const client = await openClient();
      return unwrap(await client.GET('/series/search', { params: { query: { q: termo } } }));
    },
    enabled: termo.length >= 2,
    // Ao contrário do resto do app, aqui vale segurar: o resultado não muda em minutos e cada
    // busca custa duas requisições ao TMDB do lado do servidor.
    staleTime: 5 * 60_000,
    /*
     * `always` e não o padrão `online`.
     *
     * No modo padrão o react-query PAUSA a tentativa quando julga não haver rede, e query pausada
     * fica em `pending` para sempre — a tela mostra o indicador de carregamento indefinidamente,
     * sem erro e sem resultado. Num app que passa o dia entrando e saindo de rede, isso seria a
     * regra, não a exceção.
     *
     * Aqui a falha precisa aparecer: esta é a única tela do app que não tem resposta em cache para
     * oferecer, então "não deu para buscar, precisa de rede" é a informação útil.
     */
    networkMode: 'always',
    retry: false,
  });
}

/**
 * Adiciona a série ao acervo.
 *
 * <b>Não passa pela fila offline</b>, ao contrário das marcações. A fila existe porque marcar um
 * episódio é uma afirmação sobre um instante que já aconteceu — perder isso seria perder um fato.
 * Adicionar uma série não é: ela vem de uma busca que exige rede, e enfileirar a adição de algo
 * que você só pôde encontrar online não salvaria ninguém.
 */
export function useAddSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tmdbId: number): Promise<AddSeriesResult> => {
      const client = await openClient();
      return unwrap(await client.POST('/series', { body: { tmdbId } }));
    },
    // Mesma razão da busca: sem isto o toque em "Adicionar" ficaria girando para sempre quando
    // não houvesse rede, em vez de dizer que não deu.
    networkMode: 'always',
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.series }),
        qc.invalidateQueries({ queryKey: keys.nextUp }),
        qc.invalidateQueries({ queryKey: keys.profile }),
        qc.invalidateQueries({ queryKey: ['series-search'] }),
      ]);
    },
  });
}

/** A fila de ações ainda não entregues — é o que a tela projeta por cima do dado do servidor. */
export function usePendingActions() {
  return useQuery({
    queryKey: keys.pending,
    queryFn: async (): Promise<PendingAction[]> => (await syncEngine()).queue.pending(),
    // A fila é local: sempre confiável, nunca "velha".
    staleTime: Infinity,
  });
}

export function useDeadLetters() {
  return useQuery({
    queryKey: keys.deadLetters,
    queryFn: async () => (await syncEngine()).queue.deadLetters(),
    staleTime: Infinity,
  });
}

// ── Escrita ────────────────────────────────────────────────────────────────────────────

/**
 * Toda marcação é: enfileirar → a tela reprojeta na hora → tentar entregar → recarregar do
 * servidor. O passo do meio é o que faz o app funcionar no metrô; o último é o que garante
 * que o número exibido volte a ser o derivado pelo servidor assim que houver rede.
 */
function useEnqueue() {
  const qc = useQueryClient();

  return async (draft: PendingActionDraft) => {
    const sync = await syncEngine();
    await sync.queue.enqueue(draft);
    await qc.invalidateQueries({ queryKey: keys.pending });

    const result = await sync.flush();
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.pending }),
      qc.invalidateQueries({ queryKey: keys.deadLetters }),
      // Só vale reler o servidor se algo de fato chegou lá.
      result.sent > 0 ? qc.invalidateQueries({ queryKey: keys.series }) : Promise.resolve(),
      result.sent > 0 ? qc.invalidateQueries({ queryKey: keys.nextUp }) : Promise.resolve(),
      result.sent > 0 ? qc.invalidateQueries({ queryKey: keys.profile }) : Promise.resolve(),
    ]);
    return result;
  };
}

export function useMarkEpisode() {
  const enqueue = useEnqueue();
  return useMutation({
    mutationFn: (episodeId: number) => enqueue({ kind: 'watch', episodeId }),
  });
}

export function useUnmarkEpisode() {
  const enqueue = useEnqueue();
  return useMutation({
    mutationFn: (episodeId: number) => enqueue({ kind: 'unwatch', episodeId }),
  });
}

export function useMarkSeason(seriesId: number) {
  const enqueue = useEnqueue();
  return useMutation({
    mutationFn: (seasonNumber: number) => enqueue({ kind: 'watch-season', seriesId, seasonNumber }),
  });
}

export function useMarkUpTo(seriesId: number) {
  const enqueue = useEnqueue();
  return useMutation({
    mutationFn: (target: { seasonNumber: number; episodeNumber: number }) =>
      enqueue({ kind: 'watch-up-to', seriesId, ...target }),
  });
}

/**
 * Muda o estado de acompanhamento de uma série. Passa pela mesma fila das marcações — tudo o
 * que se faz sem rede tem de sobreviver —, mas não cria nem apaga exibição nenhuma.
 */
export function useSetSeriesStatus() {
  const enqueue = useEnqueue();
  return useMutation({
    mutationFn: (target: { seriesId: number; status: string }) =>
      enqueue({ kind: 'set-status', ...target }),
  });
}

/** Empurra a fila sem enfileirar nada — o botão "sincronizar agora" e o gatilho de reconexão. */
export function useFlush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await syncEngine()).flush(),
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
  });
}
