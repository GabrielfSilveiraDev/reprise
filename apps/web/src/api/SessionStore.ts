import { SafeStorage } from '@/lib/SafeStorage'
import type { Session } from './types'

type Listener = () => void

/**
 * A sessão (par de tokens + quem é a pessoa), persistida e observável.
 *
 * Expõe `subscribe`/`getSnapshot` no formato do `useSyncExternalStore`, para o React reagir a
 * login e logout sem um contexto próprio. Escuta o evento `storage` porque o refresh token é
 * ROTATIVO: quando outra aba renova a sessão, o token antigo desta aba morre, e ela precisa
 * adotar o novo em vez de tentar usar o que já foi consumido.
 */
export class SessionStore {
  static readonly KEY = 'reprise.session'

  private current: Session | null
  private readonly listeners = new Set<Listener>()
  /**
   * Por que a última sessão acabou. A tela de login só deve lembrar "onde você estava" quando a
   * sessão caiu sozinha (refresh recusado, outra aba) — quem clicou em Sair não quer voltar lá.
   */
  endedBy: 'logout' | 'expired' | null = null

  constructor(private readonly storage: SafeStorage = new SafeStorage()) {
    this.current = this.read()
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === SessionStore.KEY) this.adopt(this.read())
      })
    }
  }

  get session(): Session | null {
    return this.current
  }

  set(session: Session): void {
    this.endedBy = null
    this.storage.set(SessionStore.KEY, JSON.stringify(session))
    this.adopt(session)
  }

  clear(reason: 'logout' | 'expired' = 'expired'): void {
    this.endedBy = reason
    this.storage.remove(SessionStore.KEY)
    this.adopt(null)
  }

  /** Relê do armazenamento — outra aba pode ter renovado a sessão neste meio-tempo. */
  reload(): Session | null {
    this.adopt(this.read())
    return this.current
  }

  /** Expira em menos de `marginMs`? Renovar antes evita a ida e volta de um 401 certo. */
  expiresSoon(session: Session, now = Date.now(), marginMs = 30_000): boolean {
    return new Date(session.accessTokenExpiresAt).getTime() - now < marginMs
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): Session | null => this.current

  private adopt(next: Session | null): void {
    if (next?.accessToken === this.current?.accessToken && next?.refreshToken === this.current?.refreshToken) return
    this.current = next
    for (const listener of this.listeners) listener()
  }

  private read(): Session | null {
    const session = this.storage.getJson<Session>(SessionStore.KEY)
    return session?.accessToken && session.refreshToken ? session : null
  }
}
