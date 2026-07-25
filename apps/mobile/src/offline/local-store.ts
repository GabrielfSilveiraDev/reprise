import * as SQLite from 'expo-sqlite';
import { SchemaSql } from './sql-database';
import type { SqlDatabase } from './sql-database';

/**
 * O banco local do app. Guarda três coisas, e só três:
 *
 * - `response_cache` — as respostas da API como vieram, para a tela abrir sem rede;
 * - `outbox` — as ações que o usuário fez e ainda não chegaram ao servidor;
 * - `settings` — o endereço da API (o IP da máquina muda de rede para rede).
 *
 * **Não é uma réplica do banco do servidor.** Foi tentador espelhar séries/temporadas/episódios
 * em tabelas e recalcular progresso aqui, mas isso duplicaria a derivação que o servidor já faz —
 * e é justamente a derivação que este projeto trata como fonte única. Um cache de documentos
 * responde exatamente às perguntas que a API responde, e a fila é projetada por cima
 * (`OutboxPlanner.project`). Se um dia o app precisar de uma consulta que a API não tem, aí sim
 * vale espelhar; hoje seria complexidade sem pergunta correspondente.
 */
export class LocalStore {
  private static readonly DatabaseName = 'reprise.db';
  private static instance: Promise<LocalStore> | null = null;

  readonly db: SqlDatabase;

  private constructor(db: SqlDatabase) {
    this.db = db;
  }

  /** Abre (uma vez) e garante o schema. Chamadas concorrentes compartilham a mesma promessa. */
  static open(): Promise<LocalStore> {
    LocalStore.instance ??= (async () => {
      const db = await SQLite.openDatabaseAsync(LocalStore.DatabaseName);
      await db.execAsync(SchemaSql);
      return new LocalStore(db);
    })();
    return LocalStore.instance;
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      key,
    );
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }
}
