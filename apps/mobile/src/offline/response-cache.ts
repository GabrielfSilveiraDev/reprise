import type { SqlDatabase } from './sql-database';

export interface CachedDocument<T> {
  readonly body: T;
  readonly fetchedAt: Date;
}

/**
 * Cache de respostas da API, para a tela abrir cheia sem rede.
 *
 * É deliberadamente burro: guarda o corpo como veio, sob a chave da consulta. Nenhuma
 * invalidação por tempo — quem decide se o dado está velho é a tela, que recebe `fetchedAt`
 * junto e mostra "atualizado há X". Um TTL escondido aqui faria a lista sumir no metrô, que é
 * exatamente o momento em que ela precisa aparecer.
 */
export class ResponseCache {
  private readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  async read<T>(key: string): Promise<CachedDocument<T> | null> {
    const row = await this.db.getFirstAsync<{ body: string; fetched_at: string }>(
      'SELECT body, fetched_at FROM response_cache WHERE key = ?',
      key,
    );
    if (!row) return null;

    try {
      return { body: JSON.parse(row.body) as T, fetchedAt: new Date(row.fetched_at) };
    } catch {
      // Corpo corrompido (interrupção no meio da escrita, downgrade de schema): tratar como
      // ausente é melhor do que derrubar a tela com um erro de parse.
      await this.db.runAsync('DELETE FROM response_cache WHERE key = ?', key);
      return null;
    }
  }

  async write(key: string, body: unknown): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO response_cache (key, body, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
      key,
      JSON.stringify(body),
      new Date().toISOString(),
    );
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM response_cache');
  }
}
