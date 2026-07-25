import { randomUUID } from 'expo-crypto';
import type { PendingAction, RepriseClient } from '@reprise/shared';
import { openClient } from '@/api/client';
import { LocalStore } from './local-store';
import { Outbox } from './outbox';
import { ResponseCache } from './response-cache';

/** Como uma tentativa de entrega terminou. */
type Delivery =
  | { readonly outcome: 'sent' }
  /** Não deu para entregar agora (rede caiu, servidor doente). A ação continua válida. */
  | { readonly outcome: 'retry'; readonly error: string }
  /** A API recusou de forma definitiva. Reenviar não vai adiantar. */
  | { readonly outcome: 'rejected'; readonly error: string };

export interface FlushResult {
  readonly sent: number;
  readonly rejected: number;
  readonly remaining: number;
  /** Por que a fila parou, quando parou antes do fim. */
  readonly stoppedBy: string | null;
}

/**
 * Envia a fila para a API e traz as respostas de volta para o cache.
 *
 * Duas decisões que valem o comentário:
 *
 * **Ordem estrita, e para no primeiro erro de rede.** Marcar e depois desmarcar não é o mesmo
 * que o contrário; pular a ação que falhou para tentar a próxima entregaria a fila fora de
 * ordem. Quando a rede volta, a fila retoma de onde parou.
 *
 * **Carta morta para 4xx.** Um 404 (episódio que não existe mais depois de um reprocessamento
 * do catálogo) travaria a fila para sempre se fosse tratado como "tente de novo". Ele sai da
 * fila de envio, mas fica registrado e visível — descartar em silêncio seria mentir para quem
 * marcou.
 */
export class SyncEngine {
  /**
   * Status 4xx que **não** são recusa da ação, e sim "tente de novo depois".
   *
   * 401 e 403 estão aqui por um motivo concreto: com o cadeado de acesso ligado, um token errado
   * devolve 401 em tudo. Tratar isso como recusa definitiva mandaria a fila inteira para carta
   * morta por causa de um campo mal digitado em Ajustes — o erro é de configuração, não da ação,
   * e some assim que o token for corrigido.
   */
  private static readonly TryAgainLater = new Set([401, 403, 408, 429]);

  private readonly outbox: Outbox;
  private readonly cache: ResponseCache;

  private constructor(outbox: Outbox, cache: ResponseCache) {
    this.outbox = outbox;
    this.cache = cache;
  }

  /** É aqui que os módulos nativos entram — as classes abaixo não os conhecem. */
  static async open(): Promise<SyncEngine> {
    const store = await LocalStore.open();
    return new SyncEngine(new Outbox(store.db, randomUUID), new ResponseCache(store.db));
  }

  async flush(): Promise<FlushResult> {
    const client = await openClient();
    const pending = await this.outbox.pending();

    let sent = 0;
    let rejected = 0;
    let stoppedBy: string | null = null;

    for (const action of pending) {
      const delivery = await SyncEngine.deliver(client, action);

      if (delivery.outcome === 'sent') {
        await this.outbox.settle(action.clientKey);
        sent += 1;
        continue;
      }

      if (delivery.outcome === 'rejected') {
        await this.outbox.deadLetter(action.clientKey, delivery.error);
        rejected += 1;
        continue;
      }

      await this.outbox.retryLater(action.clientKey, delivery.error);
      stoppedBy = delivery.error;
      break;
    }

    return { sent, rejected, remaining: await this.outbox.pendingCount(), stoppedBy };
  }

  /**
   * Entrega uma ação. O `clientKey` vai junto em todas as chamadas — é ele que faz uma
   * retentativa ser inofensiva do outro lado.
   */
  private static async deliver(client: RepriseClient, action: PendingAction): Promise<Delivery> {
    try {
      const result = await SyncEngine.send(client, action);
      if (result.error === undefined) return { outcome: 'sent' };

      const status = result.response?.status ?? 0;
      const definitive = status >= 400 && status < 500 && !SyncEngine.TryAgainLater.has(status);
      const message = `HTTP ${status}`;
      return definitive ? { outcome: 'rejected', error: message } : { outcome: 'retry', error: message };
    } catch (cause) {
      // openapi-fetch só lança quando o fetch em si falha: sem rede, DNS, host errado.
      return { outcome: 'retry', error: cause instanceof Error ? cause.message : 'sem conexão' };
    }
  }

  /**
   * O tipo de retorno é declarado à mão porque cada endpoint devolve uma união
   * `{ data } | { error }` com um payload diferente, e a união das quatro colapsa em `never`.
   * O que a entrega precisa saber é só isto: deu erro, e qual foi o status.
   */
  private static send(
    client: RepriseClient,
    action: PendingAction,
  ): Promise<{ error?: unknown; response: Response }> {
    switch (action.kind) {
      case 'watch':
        return client.POST('/episodes/{id}/watch', {
          params: { path: { id: action.episodeId } },
          body: { watchedAt: action.watchedAt, clientKey: action.clientKey },
        });

      case 'unwatch':
        return client.DELETE('/episodes/{id}/watch', {
          params: { path: { id: action.episodeId }, query: { clientKey: action.clientKey } },
        });

      case 'watch-season':
        return client.POST('/series/{id}/seasons/{seasonNumber}/watch', {
          params: { path: { id: action.seriesId, seasonNumber: action.seasonNumber } },
          body: { watchedAt: action.watchedAt, clientKey: action.clientKey },
        });

      case 'watch-up-to':
        return client.POST('/series/{id}/watch-up-to', {
          params: { path: { id: action.seriesId } },
          body: {
            seasonNumber: action.seasonNumber,
            episodeNumber: action.episodeNumber,
            watchedAt: action.watchedAt,
            clientKey: action.clientKey,
          },
        });
    }
  }

  /**
   * Busca da rede e grava no cache. Se a rede falhar, devolve o que está em cache — a tela
   * prefere um dado de ontem a uma tela vazia.
   */
  async fetchWithCache<T>(key: string, fetcher: (client: RepriseClient) => Promise<T>): Promise<T> {
    try {
      const fresh = await fetcher(await openClient());
      await this.cache.write(key, fresh);
      return fresh;
    } catch (cause) {
      const cached = await this.cache.read<T>(key);
      if (cached) return cached.body;
      throw cause;
    }
  }

  async cachedAt(key: string): Promise<Date | null> {
    return (await this.cache.read(key))?.fetchedAt ?? null;
  }

  get queue(): Outbox {
    return this.outbox;
  }
}
