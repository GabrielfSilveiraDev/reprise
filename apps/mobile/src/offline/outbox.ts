import { OutboxPlanner } from '@reprise/shared';
import type { PendingAction, PendingActionDraft } from '@reprise/shared';
import type { SqlDatabase } from './sql-database';

interface OutboxRow {
  readonly client_key: string;
  readonly kind: string;
  readonly payload: string;
  readonly queued_at: string;
  readonly attempts: number;
  readonly failed: number;
  readonly last_error: string | null;
}

/** Uma ação que a API recusou de forma definitiva — fica visível em vez de sumir. */
export interface DeadLetter {
  readonly action: PendingAction;
  readonly error: string;
  readonly queuedAt: string;
}

/**
 * A fila de saída, persistida. Executa o plano que o `OutboxPlanner` decide — a regra é dele,
 * o SQLite é daqui. Mesma divisão que a API usa entre planejador e serviço.
 *
 * Recebe o banco e o gerador de chaves de fora, em vez de importar `expo-sqlite` e
 * `expo-crypto` direto. Não é cerimônia: é o que permite rodar esta classe — a mais arriscada
 * do app — contra um SQLite de verdade no executor de testes do Node.
 */
export class Outbox {
  private readonly db: SqlDatabase;
  private readonly newKey: () => string;

  constructor(db: SqlDatabase, newKey: () => string) {
    this.db = db;
    this.newKey = newKey;
  }

  /**
   * Enfileira uma ação e devolve a fila resultante.
   *
   * A chave de idempotência nasce aqui, **antes** de qualquer tentativa de envio, e é a mesma
   * em todas as retentativas — é o que impede que uma resposta perdida vire um rewatch fantasma
   * no servidor. `watchedAt` também é carimbado aqui: a exibição aconteceu quando o dedo tocou
   * a tela, não quando o wi-fi voltou.
   */
  async enqueue(draft: PendingActionDraft): Promise<PendingAction[]> {
    const incoming = {
      ...draft,
      clientKey: this.newKey(),
      watchedAt: new Date().toISOString(),
    } as PendingAction;

    const pending = await this.pending();
    const plan = OutboxPlanner.planEnqueue(pending, incoming);

    await this.db.withTransactionAsync(async () => {
      for (const clientKey of plan.drop) {
        await this.db.runAsync('DELETE FROM outbox WHERE client_key = ?', clientKey);
      }
      if (plan.add) {
        await this.db.runAsync(
          'INSERT INTO outbox (client_key, kind, payload, queued_at) VALUES (?, ?, ?, ?)',
          plan.add.clientKey,
          plan.add.kind,
          JSON.stringify(plan.add),
          plan.add.watchedAt,
        );
      }
    });

    return this.pending();
  }

  /** As ações ainda por enviar, na ordem em que aconteceram. */
  async pending(): Promise<PendingAction[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox WHERE failed = 0 ORDER BY id',
    );
    return rows.map((r) => JSON.parse(r.payload) as PendingAction);
  }

  async pendingCount(): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      'SELECT count(*) AS n FROM outbox WHERE failed = 0',
    );
    return row?.n ?? 0;
  }

  /** A ação chegou ao servidor. Sai da fila. */
  async settle(clientKey: string): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox WHERE client_key = ?', clientKey);
  }

  /**
   * A tentativa falhou por rede ou por erro do servidor: conta a tentativa e mantém na fila.
   * A ação continua válida, só não deu para entregar ainda.
   */
  async retryLater(clientKey: string, error: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE client_key = ?',
      error,
      clientKey,
    );
  }

  /**
   * A API recusou de forma definitiva (4xx): reenviar nunca vai funcionar. A ação sai da fila
   * de envio mas **não some** — some seria mentir para quem marcou. Vira carta morta visível.
   */
  async deadLetter(clientKey: string, error: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE outbox SET failed = 1, last_error = ? WHERE client_key = ?',
      error,
      clientKey,
    );
  }

  async deadLetters(): Promise<DeadLetter[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox WHERE failed = 1 ORDER BY id',
    );
    return rows.map((r) => ({
      action: JSON.parse(r.payload) as PendingAction,
      error: r.last_error ?? 'erro desconhecido',
      queuedAt: r.queued_at,
    }));
  }

  async discardDeadLetters(): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox WHERE failed = 1');
  }
}
