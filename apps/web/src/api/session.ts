export interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: string;
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
}

const KEY = 'reprise.session';

/**
 * A sessão no navegador.
 *
 * <b>`localStorage`, e o que isso custa.</b> No celular a sessão vai para o cofre do sistema;
 * aqui não existe equivalente. A alternativa correta seria o refresh token num cookie
 * `HttpOnly`+`SameSite`, fora do alcance de JavaScript — mas isso exige que API e web
 * compartilhem origem ou que se configure CORS com credenciais, e hoje o web fala com a API por
 * proxy do Vite em desenvolvimento e por origem própria em produção.
 *
 * Enquanto isso não se decide, `localStorage` é a escolha consciente: quem conseguir executar
 * script nesta origem já ganhou o jogo de qualquer forma. Está anotado como dívida, não como
 * descuido.
 */
export class WebSession {
  static read(): StoredSession | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }

  static write(session: StoredSession): void {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  static clear(): void {
    localStorage.removeItem(KEY);
  }

  /** Margem porque o servidor valida sem tolerância de relógio. */
  static isExpired(session: StoredSession, marginSeconds = 60): boolean {
    const expiry = Date.parse(session.accessTokenExpiresAt);
    if (Number.isNaN(expiry)) return true;
    return expiry - Date.now() <= marginSeconds * 1000;
  }
}
