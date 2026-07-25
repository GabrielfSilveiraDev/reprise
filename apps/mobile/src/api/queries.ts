import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NextUpItem,
  PendingAction,
  PendingActionDraft,
  Profile,
  SeriesDetail,
  SeriesListItem,
  StatsOverviewDto,
} from '@reprise/shared';
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
  stats: (includeBackfill: boolean) => ['stats', includeBackfill] as const,
  pending: ['pending'] as const,
  deadLetters: ['dead-letters'] as const,
};

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) throw new Error(String(result.error));
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
