import { ACCESS_TOKEN_HEADER } from '@reprise/shared';
import { AccessToken, ApiEndpoint } from './client';
import { AuthSession } from './session';
import type { StoredSession } from './session';

/**
 * Autenticação: entrar, sair e renovar.
 *
 * Fala com `/auth/*` por `fetch` direto, e não pelo cliente gerado, de propósito: o cliente
 * gerado carrega o interceptador que renova o token, e usá-lo aqui criaria recursão — renovar
 * dispararia renovar.
 */
export class Auth {
  static async login(email: string, password: string): Promise<StoredSession> {
    const session = await Auth.post<StoredSession>('/auth/login', { email, password });
    await AuthSession.write(session);
    return session;
  }

  static async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<StoredSession> {
    const session = await Auth.post<StoredSession>('/auth/register', {
      email,
      password,
      displayName,
    });
    await AuthSession.write(session);
    return session;
  }

  static async logout(): Promise<void> {
    const session = await AuthSession.read();
    // Avisa o servidor para revogar a sessão, mas sair localmente não pode depender disso:
    // ficar preso numa conta porque a rede caiu seria absurdo.
    if (session) {
      try {
        await Auth.post('/auth/logout', { refreshToken: session.refreshToken });
      } catch {
        /* ignorado de propósito */
      }
    }
    await AuthSession.clear();
  }

  /**
   * Renova o par de tokens.
   *
   * <b>Uma renovação por vez.</b> Uma tela dispara várias requisições juntas e todas podem
   * receber 401 ao mesmo tempo; sem esta trava, cada uma tentaria renovar, e como o servidor gira
   * o refresh a cada uso, a primeira invalidaria as outras — resultado: o usuário seria deslogado
   * justamente por ter várias chamadas em voo.
   */
  private static inFlight: Promise<StoredSession | null> | null = null;

  static refresh(): Promise<StoredSession | null> {
    Auth.inFlight ??= Auth.doRefresh().finally(() => {
      Auth.inFlight = null;
    });
    return Auth.inFlight;
  }

  private static async doRefresh(): Promise<StoredSession | null> {
    const session = await AuthSession.read();
    if (!session) return null;

    try {
      const renewed = await Auth.post<StoredSession>('/auth/refresh', {
        refreshToken: session.refreshToken,
      });
      await AuthSession.write(renewed);
      return renewed;
    } catch {
      // Refresh recusado significa sessão morta: expirou, foi revogada ou já foi consumida.
      // Limpar leva à tela de login, que é a única saída honesta.
      await AuthSession.clear();
      return null;
    }
  }

  private static async post<T>(path: string, body: unknown): Promise<T> {
    const [baseUrl, gateToken] = await Promise.all([ApiEndpoint.read(), AccessToken.read()]);

    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gateToken ? { [ACCESS_TOKEN_HEADER]: gateToken } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new AuthError(response.status);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
}

/** Erro com o status HTTP preservado — a tela precisa dele para dizer o que houve. */
export class AuthError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(Auth_message(status));
    this.status = status;
  }
}

function Auth_message(status: number): string {
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
