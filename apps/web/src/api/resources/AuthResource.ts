import { ApiError } from '../ApiError'
import type { SessionStore } from '../SessionStore'
import type { Registration, Session } from '../types'
import { type Http, Resource } from './Resource'

export type ServerState = 'open' | 'locked' | 'offline'

export interface RegisterInput {
  email: string
  password: string
  displayName: string
  userName: string | null
}

/** Login, cadastro e sessão. Usa o cliente SEM Bearer — estas rotas são as que criam o Bearer. */
export class AuthResource extends Resource {
  constructor(
    http: Http,
    private readonly sessions: SessionStore,
  ) {
    super(http)
  }

  async login(identifier: string, password: string): Promise<Session> {
    const session = await this.call(this.http.POST('/auth/login', { body: { identifier, password } }))
    this.sessions.set(session)
    return session
  }

  register(input: RegisterInput): Promise<Registration> {
    return this.call(this.http.POST('/auth/register', { body: input }))
  }

  async confirm(email: string, code: string): Promise<Session> {
    const session = await this.call(this.http.POST('/auth/confirm', { body: { email, code } }))
    this.sessions.set(session)
    return session
  }

  async resend(email: string): Promise<void> {
    await this.call(this.http.POST('/auth/resend', { body: { email } }))
  }

  /** Troca o refresh token. `null` quando o servidor recusa; falha de rede propaga. */
  async exchange(refreshToken: string): Promise<Session | null> {
    try {
      return await this.call(this.http.POST('/auth/refresh', { body: { refreshToken } }))
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) return null
      throw error
    }
  }

  /**
   * Sai: esquece a sessão AQUI primeiro e só depois avisa o servidor. Se a rede falhar no aviso,
   * a pessoa ainda assim saiu desta tela — o refresh token órfão expira sozinho.
   */
  async logout(): Promise<void> {
    const session = this.sessions.session
    this.sessions.clear('logout')
    if (!session) return
    await this.call(this.http.POST('/auth/logout', { body: { refreshToken: session.refreshToken } })).catch(() => undefined)
  }

  /**
   * A raiz da API não exige login. Se ela responde 401, só pode ser o cadeado de acesso —
   * e é assim que a tela de login sabe que precisa pedir a chave do servidor.
   */
  async probe(): Promise<ServerState> {
    try {
      const { response } = await this.http.GET('/')
      return response.status === 401 ? 'locked' : 'open'
    } catch {
      return 'offline'
    }
  }
}
