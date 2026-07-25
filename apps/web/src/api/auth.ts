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
  /** `identifier` é e-mail ou nome de usuário — o servidor aceita os dois. */
  static async login(identifier: string, password: string): Promise<StoredSession> {
    const session = await Auth.post<StoredSession>('/auth/login', { identifier, password });
    WebSession.write(session);
    return session;
  }

  /**
   * Cria a conta. <b>Não devolve sessão</b>: ela nasce por confirmar, e é o código enviado por
   * e-mail que a libera. Devolver sessão aqui esvaziaria a validação.
   */
  static async register(
    email: string,
    password: string,
    displayName: string,
    userName: string,
  ): Promise<RegistrationResponse> {
    return Auth.post<RegistrationResponse>('/auth/register', {
      email,
      password,
      displayName,
      userName,
    });
  }

  static async confirm(email: string, code: string): Promise<StoredSession> {
    const session = await Auth.post<StoredSession>('/auth/confirm', { email, code });
    WebSession.write(session);
    return session;
  }

  static async resend(email: string): Promise<void> {
    await Auth.post('/auth/resend', { email });
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

export interface RegistrationResponse {
  readonly email: string;
  /** Falso quando o servidor não tem SMTP — o código foi para o log dele. */
  readonly emailSent: boolean;
  readonly message: string;
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
      return 'Usuário ou senha incorretos.';
    case 403:
      return 'Confirme seu e-mail antes de entrar, ou o cadastro está fechado nesta instância.';
    case 409:
      return 'Já existe uma conta com este e-mail.';
    case 400:
      return 'Senha muito curta — o mínimo são 10 caracteres.';
    default:
      return `Não deu para falar com a API (HTTP ${status}).`;
  }
}
