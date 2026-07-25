import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'reprise.session';

export interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: string;
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
}

/**
 * A sessão do usuário, no cofre do sistema.
 *
 * <b>Cofre, e não o SQLite do app.</b> O banco local guarda cache e fila — coisas que podem ser
 * recriadas. Um refresh token vale sessenta dias de acesso à conta e não pode morar junto com a
 * lista de séries. No Android isso é o Keystore.
 *
 * A leitura é memorizada porque cada requisição precisa do token e ir ao cofre a cada uma
 * custaria caro numa lista que dispara dezenas de chamadas.
 */
export class AuthSession {
  private static cached: StoredSession | null | undefined;

  static async read(): Promise<StoredSession | null> {
    if (AuthSession.cached !== undefined) return AuthSession.cached;

    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      AuthSession.cached = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      // Cofre indisponível ou conteúdo corrompido: tratar como deslogado leva à tela de login,
      // que é recuperável. Propagar o erro deixaria o app sem saída.
      AuthSession.cached = null;
    }

    return AuthSession.cached;
  }

  static async write(session: StoredSession): Promise<void> {
    AuthSession.cached = session;
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }

  static async clear(): Promise<void> {
    AuthSession.cached = null;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  /** Sem I/O — para quem já leu e quer decidir rápido. */
  static peek(): StoredSession | null {
    return AuthSession.cached ?? null;
  }

  /**
   * Se o token de acesso já venceu (ou vence nos próximos instantes). A margem existe porque o
   * servidor valida sem tolerância de relógio: renovar em cima da hora perderia a corrida.
   */
  static isExpired(session: StoredSession, marginSeconds = 60): boolean {
    const expiry = Date.parse(session.accessTokenExpiresAt);
    if (Number.isNaN(expiry)) return true;
    return expiry - Date.now() <= marginSeconds * 1000;
  }
}
