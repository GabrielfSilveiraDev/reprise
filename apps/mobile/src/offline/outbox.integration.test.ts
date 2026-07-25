import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Outbox } from './outbox.ts';
import { ResponseCache } from './response-cache.ts';
import { SchemaSql } from './sql-database.ts';
import type { SqlDatabase } from './sql-database.ts';

/**
 * Teste de integração da camada offline contra um SQLite **de verdade**.
 *
 * Os testes do `OutboxPlanner` cobrem a decisão; estes cobrem a execução — o SQL, a transação,
 * a ordem de saída, a serialização da ação. É a costura entre plano e banco, que é onde erro de
 * `?` trocado ou `ORDER BY` esquecido mora, e nada disso apareceria num teste da lógica pura.
 *
 * O `node:sqlite` faz o papel do `expo-sqlite` — mesmo motor, mesmo dialeto, **mesmo schema**
 * (importado de `sql-database.ts`, não recopiado aqui). O que ele não cobre é o módulo nativo do
 * Android em si, que só o aparelho exercita.
 */

/** Adaptador do `node:sqlite` (síncrono) para a interface que a camada offline espera. */
class NodeSqlDatabase implements SqlDatabase {
  private readonly db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(':memory:');
  }

  async execAsync(source: string): Promise<void> {
    // O `journal_mode = WAL` não se aplica a banco em memória; o resto do schema, sim.
    this.db.exec(source.replace(/PRAGMA journal_mode = WAL;/, ''));
  }

  async runAsync(source: string, ...params: (string | number | null)[]): Promise<unknown> {
    return this.db.prepare(source).run(...params);
  }

  async getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]> {
    return this.db.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null> {
    return (this.db.prepare(source).get(...params) as T) ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (cause) {
      this.db.exec('ROLLBACK');
      throw cause;
    }
  }

  close() {
    this.db.close();
  }
}

async function novaFila() {
  const db = new NodeSqlDatabase();
  await db.execAsync(SchemaSql);
  return { db, outbox: new Outbox(db, randomUUID) };
}

describe('Outbox contra SQLite real', () => {
  it('o schema do app cria as três tabelas', async () => {
    const { db } = await novaFila();
    const tabelas = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const nomes = tabelas.map((t) => t.name);
    for (const esperada of ['outbox', 'response_cache', 'settings']) {
      assert.ok(nomes.includes(esperada), `faltou a tabela ${esperada}`);
    }
    db.close();
  });

  it('enfileira e devolve na ordem em que aconteceu', async () => {
    const { db, outbox } = await novaFila();

    await outbox.enqueue({ kind: 'watch', episodeId: 10 });
    await outbox.enqueue({ kind: 'watch', episodeId: 20 });
    await outbox.enqueue({ kind: 'watch-season', seriesId: 7, seasonNumber: 2 });

    const fila = await outbox.pending();
    assert.deepEqual(
      fila.map((a) => a.kind),
      ['watch', 'watch', 'watch-season'],
    );
    assert.equal(fila[0]?.kind === 'watch' ? fila[0].episodeId : null, 10);
    assert.equal(await outbox.pendingCount(), 3);
    db.close();
  });

  it('carimba uma chave única e uma data por ação', async () => {
    const { db, outbox } = await novaFila();
    await outbox.enqueue({ kind: 'watch', episodeId: 10 });
    await outbox.enqueue({ kind: 'watch', episodeId: 10 });

    const fila = await outbox.pending();
    assert.notEqual(fila[0]?.clientKey, fila[1]?.clientKey, 'duas ações, duas chaves');
    assert.ok(fila[0]?.watchedAt, 'a data do toque é gravada na hora, não no envio');
    assert.ok(!Number.isNaN(Date.parse(fila[0]!.watchedAt)));
    db.close();
  });

  it('desmarcar anula uma marcação pendente e a fila volta a ficar vazia', async () => {
    const { db, outbox } = await novaFila();

    await outbox.enqueue({ kind: 'watch', episodeId: 10 });
    assert.equal(await outbox.pendingCount(), 1);

    await outbox.enqueue({ kind: 'unwatch', episodeId: 10 });
    assert.equal(await outbox.pendingCount(), 0, 'nada é enviado — as duas se anulam');
    db.close();
  });

  it('desmarcar sem marcação pendente vira ação de verdade', async () => {
    const { db, outbox } = await novaFila();
    await outbox.enqueue({ kind: 'unwatch', episodeId: 10 });

    const fila = await outbox.pending();
    assert.equal(fila.length, 1);
    assert.equal(fila[0]?.kind, 'unwatch');
    db.close();
  });

  it('entregue sai da fila; recusado vira carta morta e não volta a ser enviado', async () => {
    const { db, outbox } = await novaFila();

    await outbox.enqueue({ kind: 'watch', episodeId: 10 });
    await outbox.enqueue({ kind: 'watch', episodeId: 20 });
    const [entregue, recusada] = await outbox.pending();

    await outbox.settle(entregue!.clientKey);
    await outbox.deadLetter(recusada!.clientKey, 'HTTP 404');

    assert.equal(await outbox.pendingCount(), 0);

    const mortas = await outbox.deadLetters();
    assert.equal(mortas.length, 1);
    assert.equal(mortas[0]?.error, 'HTTP 404');
    assert.equal(
      mortas[0]?.action.kind === 'watch' ? mortas[0].action.episodeId : null,
      20,
      'a ação recusada continua legível — não some em silêncio',
    );

    await outbox.discardDeadLetters();
    assert.equal((await outbox.deadLetters()).length, 0);
    db.close();
  });

  it('falha de rede mantém a ação na fila e conta a tentativa', async () => {
    const { db, outbox } = await novaFila();
    await outbox.enqueue({ kind: 'watch', episodeId: 10 });
    const [acao] = await outbox.pending();

    await outbox.retryLater(acao!.clientKey, 'sem conexão');
    await outbox.retryLater(acao!.clientKey, 'sem conexão');

    assert.equal(await outbox.pendingCount(), 1, 'continua na fila');
    const row = await db.getFirstAsync<{ attempts: number; last_error: string }>(
      'SELECT attempts, last_error FROM outbox WHERE client_key = ?',
      acao!.clientKey,
    );
    assert.equal(row?.attempts, 2);
    assert.equal(row?.last_error, 'sem conexão');
    db.close();
  });
});

describe('ResponseCache contra SQLite real', () => {
  it('devolve o documento e quando ele foi buscado', async () => {
    const db = new NodeSqlDatabase();
    await db.execAsync(SchemaSql);
    const cache = new ResponseCache(db);

    await cache.write('series', [{ id: 1, name: 'How I Met Your Mother' }]);
    const doc = await cache.read<{ id: number; name: string }[]>('series');

    assert.equal(doc?.body[0]?.name, 'How I Met Your Mother');
    assert.ok(doc?.fetchedAt instanceof Date);
    db.close();
  });

  it('regravar a mesma chave substitui em vez de duplicar', async () => {
    const db = new NodeSqlDatabase();
    await db.execAsync(SchemaSql);
    const cache = new ResponseCache(db);

    await cache.write('series', [{ id: 1 }]);
    await cache.write('series', [{ id: 1 }, { id: 2 }]);

    const doc = await cache.read<unknown[]>('series');
    assert.equal(doc?.body.length, 2);
    const { n } = (await db.getFirstAsync<{ n: number }>(
      'SELECT count(*) AS n FROM response_cache',
    ))!;
    assert.equal(n, 1);
    db.close();
  });

  it('corpo corrompido é tratado como ausente, não derruba a tela', async () => {
    const db = new NodeSqlDatabase();
    await db.execAsync(SchemaSql);
    const cache = new ResponseCache(db);

    await db.runAsync(
      'INSERT INTO response_cache (key, body, fetched_at) VALUES (?, ?, ?)',
      'series',
      '{isso não é json',
      new Date().toISOString(),
    );

    assert.equal(await cache.read('series'), null);
    const { n } = (await db.getFirstAsync<{ n: number }>(
      'SELECT count(*) AS n FROM response_cache',
    ))!;
    assert.equal(n, 0, 'a linha ruim é removida em vez de ficar envenenando as leituras');
    db.close();
  });
});

/**
 * A ponta final: as mesmas requisições que o `SyncEngine` monta, contra a API rodando.
 *
 * Prova o que nenhum teste em memória prova — que a chave de idempotência que o app gera é
 * aceita e respeitada do outro lado. Pula sozinho quando a API não está no ar, para não
 * quebrar a suíte de quem só quer rodar o domínio.
 */
describe('Entrega contra a API real', () => {
  const baseUrl = process.env.REPRISE_API_URL ?? 'http://localhost:5156';
  let disponivel = false;
  let seriesId: number | null = null;
  let episodeId: number | null = null;

  before(async () => {
    try {
      const ping = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      disponivel = ping.ok;
      if (!disponivel) return;
      // Um episódio qualquer serve — o teste desfaz o que fizer.
      const series = (await (await fetch(`${baseUrl}/series`)).json()) as { id: number }[];
      seriesId = series[0]!.id;
      const detail = (await (await fetch(`${baseUrl}/series/${seriesId}`)).json()) as {
        seasons: { episodes: { id: number }[] }[];
      };
      episodeId = detail.seasons[0]?.episodes[0]?.id ?? null;
    } catch {
      disponivel = false;
    }
  });

  it('a mesma clientKey enviada três vezes cria uma exibição só', async (t) => {
    if (!disponivel || episodeId === null) return t.skip('API fora do ar');

    const antes = await watchCount(baseUrl, seriesId!, episodeId);
    const clientKey = randomUUID();
    const body = JSON.stringify({ watchedAt: new Date().toISOString(), clientKey });

    for (let i = 0; i < 3; i += 1) {
      const res = await fetch(`${baseUrl}/episodes/${episodeId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      assert.equal(res.ok, true, `tentativa ${i + 1} respondeu ${res.status}`);
    }

    assert.equal(
      await watchCount(baseUrl, seriesId!, episodeId),
      antes + 1,
      'três entregas da mesma ação = uma exibição',
    );

    // Desfaz, com chave própria.
    await fetch(`${baseUrl}/episodes/${episodeId}/watch?clientKey=${randomUUID()}`, {
      method: 'DELETE',
    });
    assert.equal(await watchCount(baseUrl, seriesId!, episodeId), antes, 'estado restaurado');
  });

  it('chaves diferentes criam rewatch de verdade', async (t) => {
    if (!disponivel || episodeId === null) return t.skip('API fora do ar');

    const antes = await watchCount(baseUrl, seriesId!, episodeId);
    for (let i = 0; i < 2; i += 1) {
      await fetch(`${baseUrl}/episodes/${episodeId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchedAt: new Date().toISOString(), clientKey: randomUUID() }),
      });
    }
    assert.equal(await watchCount(baseUrl, seriesId!, episodeId), antes + 2);

    for (let i = 0; i < 2; i += 1) {
      await fetch(`${baseUrl}/episodes/${episodeId}/watch?clientKey=${randomUUID()}`, {
        method: 'DELETE',
      });
    }
    assert.equal(await watchCount(baseUrl, seriesId!, episodeId), antes, 'estado restaurado');
  });

  it('desmarcar com a mesma chave remove uma exibição só', async (t) => {
    if (!disponivel || episodeId === null) return t.skip('API fora do ar');

    const antes = await watchCount(baseUrl, seriesId!, episodeId);
    await fetch(`${baseUrl}/episodes/${episodeId}/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchedAt: new Date().toISOString(), clientKey: randomUUID() }),
    });
    assert.equal(await watchCount(baseUrl, seriesId!, episodeId), antes + 1);

    const clientKey = randomUUID();
    for (let i = 0; i < 3; i += 1) {
      await fetch(`${baseUrl}/episodes/${episodeId}/watch?clientKey=${clientKey}`, {
        method: 'DELETE',
      });
    }
    assert.equal(await watchCount(baseUrl, seriesId!, episodeId), antes, 'três entregas removeram uma só');
  });

  after(async () => {
    if (!disponivel || episodeId === null) return;
    // Rede de segurança: se alguma asserção falhou no meio, o episódio não fica sujo.
    process.stdout.write(`\n  estado final do episódio ${episodeId}: ${await watchCount(baseUrl, seriesId!, episodeId)} exibição(ões)\n`);
  });
});

/** A contagem vem do detalhe da série — que é onde o servidor a deriva do log de eventos. */
async function watchCount(baseUrl: string, seriesId: number, episodeId: number): Promise<number> {
  const detail = (await (await fetch(`${baseUrl}/series/${seriesId}`)).json()) as {
    seasons: { episodes: { id: number; watchCount: number }[] }[];
  };
  for (const season of detail.seasons) {
    const found = season.episodes.find((e) => e.id === episodeId);
    if (found) return found.watchCount;
  }
  throw new Error(`episódio ${episodeId} não encontrado na série ${seriesId}`);
}
