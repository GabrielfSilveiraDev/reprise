import { WebSession } from './session';
import type { StoredSession } from './session';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Autenticação do cliente web. Espelha a do app: mesma API, mesmas regras, mesmas mensagens.
 *
 * Fala por `fetch` direto e não pelo cliente gerado — o gerado é quem renova o token, e usá-lo
 * aqui faria renovar chamar renovar.
 */
export class Auth {
  static async login(email: string, password: string): Promise<StoredSession> {
    const session = await Auth.post<StoredSession>('/auth/login', { email, password });
    WebSession.write(session);
    return session;
  }

  static async register(email: string, password: string, displayName: string): Promise<StoredSession> {
    const session = await Auth.post<StoredSession>('/auth/register', { email, password, displayName });
    WebSession.write(session);
    return session;
  }

  static async logout(): Promise<void> {
    const session = WebSession.read();
    if (session) {
      // Sair localmente não pode depender da rede: ficar preso numa conta seria absurdo.
      try {
        await Auth.post('/auth/logout', { refreshToken: session.refreshToken });
      } catch {
        /* ignorado de propósito */
      }
    }
    WebSession.clear();
  }

  /**
   * Uma renovação por vez. Sem a trava, várias chamadas simultâneas renovariam em paralelo e —
   * como o servidor gira o refresh a cada uso — a primeira invalidaria as outras, deslogando o
   * usuário justamente por ter a tela cheia de requisições.
   */
  private static inFlight: Promise<StoredSession | null> | null = null;

  static refresh(): Promise<StoredSession | null> {
    Auth.inFlight ??= Auth.doRefresh().finally(() => {
      Auth.inFlight = null;
    });
    return Auth.inFlight;
  }

  private static async doRefresh(): Promise<StoredSession | null> {
    const session = WebSession.read();
    if (!session) return null;

    try {
      const renewed = await Auth.post<StoredSession>('/auth/refresh', {
        refreshToken: session.refreshToken,
      });
      WebSession.write(renewed);
      return renewed;
    } catch {
      WebSession.clear();
      return null;
    }
  }

  private static async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new AuthError(response.status);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
}

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(messageFor(status));
    this.status = status;
  }
}

function messageFor(status: number): string {
  switch (status) {
    case 401:
      return 'E-mail ou senha incorretos.';
    case 403:
      return 'O cadastro está fechado nesta instância.';
    case 409:
      return 'Já existe uma conta com este e-mail.';
    case 400:
      return 'Senha muito curta — o mínimo são 10 caracteres.';
    default:
      return `Não deu para falar com a API (HTTP ${status}).`;
  }
}
