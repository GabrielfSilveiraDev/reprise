/**
 * A fila de saída do app offline — a parte que decide, sem tocar em banco nem em rede.
 *
 * O mesmo desenho que a API usa (planejador puro + serviço fino de persistência): aqui mora
 * a regra, e quem grava no SQLite só executa o plano. É o que torna esta lógica — a mais
 * arriscada da fase — testável com `node --test`, sem emulador Android no caminho.
 */

/** Uma ação de escrita enfileirada. `clientKey` é a chave de idempotência que a API consome. */
export type PendingAction =
  | { readonly kind: 'watch'; readonly clientKey: string; readonly episodeId: number; readonly watchedAt: string }
  | { readonly kind: 'unwatch'; readonly clientKey: string; readonly episodeId: number; readonly watchedAt: string }
  | {
      readonly kind: 'watch-season';
      readonly clientKey: string;
      readonly seriesId: number;
      readonly seasonNumber: number;
      readonly watchedAt: string;
    }
  | {
      readonly kind: 'watch-up-to';
      readonly clientKey: string;
      readonly seriesId: number;
      readonly seasonNumber: number;
      readonly episodeNumber: number;
      readonly watchedAt: string;
    };

export type PendingActionKind = PendingAction['kind'];

/** `Omit` sobre união precisa distribuir, senão sobra só o que os membros têm em comum. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Uma ação como a tela a descreve: sem `clientKey` nem `watchedAt`, que a fila carimba na
 * hora de enfileirar (a chave antes da primeira tentativa, a data no momento do toque).
 */
export type PendingActionDraft = DistributiveOmit<PendingAction, 'clientKey' | 'watchedAt'>;

/** O mínimo que a projeção precisa saber de um episódio. */
export interface ProjectableEpisode {
  readonly id: number;
  readonly seriesId: number;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** Quantas exibições o servidor conhece — o que veio no último sync. */
  readonly watchCount: number;
}

/** O que gravar na fila ao enfileirar uma ação nova. */
export interface EnqueuePlan {
  /** Chaves de ações pendentes que devem sair da fila (foram anuladas pela nova). */
  readonly drop: readonly string[];
  /** A ação a acrescentar, ou `null` quando ela apenas anulou uma pendente. */
  readonly add: PendingAction | null;
}

export class OutboxPlanner {
  /**
   * Decide o que a fila vira ao receber uma ação nova.
   *
   * A única fusão feita aqui é a que importa: desmarcar um episódio que tem uma marcação
   * ainda **não enviada** anula as duas. Não é economia de rede — é correção. Mandando as
   * duas, o servidor remove "a exibição mais recente", que pode não ser a que acabou de ser
   * criada (se o usuário datou a marcação para trás, a mais recente é um rewatch antigo e
   * legítimo). Anular localmente devolve exatamente o estado anterior; enviar não garante isso.
   *
   * Nada mais é fundido. Duas marcações seguidas no mesmo episódio são um rewatch de verdade,
   * e as marcações em massa dependem do que o servidor já tem — supor o efeito delas aqui
   * seria adivinhar.
   */
  static planEnqueue(pending: readonly PendingAction[], incoming: PendingAction): EnqueuePlan {
    if (incoming.kind === 'unwatch') {
      const cancelled = OutboxPlanner.lastPendingWatch(pending, incoming.episodeId);
      if (cancelled) return { drop: [cancelled.clientKey], add: null };
    }
    return { drop: [], add: incoming };
  }

  private static lastPendingWatch(
    pending: readonly PendingAction[],
    episodeId: number,
  ): PendingAction | null {
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const action = pending[i];
      if (!action) continue;
      if (action.kind === 'watch' && action.episodeId === episodeId) return action;
      // Uma marcação em massa depois dela pode ter tocado o mesmo episódio; a partir daqui
      // não dá para saber o que anula o quê, então paramos e mandamos a desmarcação de verdade.
      if (action.kind === 'watch-season' || action.kind === 'watch-up-to') return null;
    }
    return null;
  }

  /**
   * Projeta a fila sobre o estado do servidor: quantas exibições cada episódio tem **agora**,
   * do ponto de vista de quem está com o celular na mão.
   *
   * Existe porque o estado real é derivado no servidor e o app offline não fala com ele. Sem
   * isso, tocar "assisti" no metrô não muda nada na tela até reconectar. A projeção é
   * descartável por construção: no próximo sync o servidor sobrescreve tudo.
   *
   * As regras de massa espelham as do servidor — só marcam o que ainda não foi visto —, então
   * a tela não promete um rewatch que a sincronização não vai criar.
   */
  static project(
    episodes: readonly ProjectableEpisode[],
    pending: readonly PendingAction[],
  ): ReadonlyMap<number, number> {
    const counts = new Map<number, number>(episodes.map((e) => [e.id, e.watchCount]));
    const byId = new Map<number, ProjectableEpisode>(episodes.map((e) => [e.id, e]));

    const bump = (id: number, delta: number) => {
      if (!counts.has(id)) return;
      counts.set(id, Math.max(0, (counts.get(id) ?? 0) + delta));
    };

    for (const action of pending) {
      switch (action.kind) {
        case 'watch':
          bump(action.episodeId, +1);
          break;

        case 'unwatch':
          bump(action.episodeId, -1);
          break;

        case 'watch-season':
          for (const e of byId.values()) {
            if (e.seriesId === action.seriesId && e.seasonNumber === action.seasonNumber) {
              if ((counts.get(e.id) ?? 0) === 0) bump(e.id, +1);
            }
          }
          break;

        case 'watch-up-to':
          for (const e of byId.values()) {
            if (e.seriesId !== action.seriesId || e.seasonNumber <= 0) continue;
            const upTo =
              e.seasonNumber < action.seasonNumber ||
              (e.seasonNumber === action.seasonNumber && e.episodeNumber <= action.episodeNumber);
            if (upTo && (counts.get(e.id) ?? 0) === 0) bump(e.id, +1);
          }
          break;
      }
    }

    return counts;
  }

  /** Quantas ações da fila tocam esta série — o que a lista usa para mostrar "pendente". */
  static countForSeries(
    pending: readonly PendingAction[],
    seriesId: number,
    episodeSeries: ReadonlyMap<number, number>,
  ): number {
    return pending.filter((a) =>
      a.kind === 'watch' || a.kind === 'unwatch'
        ? episodeSeries.get(a.episodeId) === seriesId
        : a.seriesId === seriesId,
    ).length;
  }
}
