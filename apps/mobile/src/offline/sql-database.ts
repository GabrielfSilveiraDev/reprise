/**
 * O mínimo de banco que a camada offline usa — um subconjunto estrutural da API do
 * `expo-sqlite`, escrito à mão aqui.
 *
 * Existe por um motivo prático: com a `Outbox` dependendo desta interface em vez do módulo
 * nativo, ela roda no executor de testes do Node contra o `node:sqlite`, com o **mesmo SQL** que
 * o Android executa. Sem isso, a única forma de conferir a fila seria com o celular na mão —
 * e a fila é a peça mais arriscada do app.
 */
export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * O schema local. Fica aqui, e não embutido no `LocalStore`, para que o teste crie exatamente
 * as mesmas tabelas que o app cria — schema duplicado no teste passaria enquanto o de verdade
 * quebrava.
 *
 * WAL: leitura e escrita simultâneas sem travar a UI enquanto a sincronização roda.
 * O `id` AUTOINCREMENT da outbox é o que define a ordem de envio, e a ordem importa:
 * marcar e depois desmarcar não é o mesmo que o contrário.
 */
export const SchemaSql = `
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS response_cache (
    key        TEXT PRIMARY KEY,
    body       TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outbox (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_key TEXT NOT NULL UNIQUE,
    kind       TEXT NOT NULL,
    payload    TEXT NOT NULL,
    queued_at  TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    failed     INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );

  CREATE INDEX IF NOT EXISTS ix_outbox_pending ON outbox (failed, id);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;
