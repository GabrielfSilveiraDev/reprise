import { SESSION_LOCK } from './AuthenticatedFetch'
import type { AuthResource } from './resources/AuthResource'
import type { SessionStore } from './SessionStore'

/** Como terminou o passe desta carga. `none` = a página não veio do launcher. */
export type LauncherOutcome = 'none' | 'ok' | 'rejected' | 'offline'

type Locks = Pick<LockManager, 'request'>
type Address = Pick<Window, 'location' | 'history'>

/**
 * O passe de entrada do launcher do Windows: a janela dele abre em `#entrar=<passe>`, e o passe
 * vira sessão aqui, sem senha.
 *
 * <b>O que é o passe.</b> Uma credencial de uso único e vida curta, emitida pela CLI do Reprise
 * para o dono da instalação — quem alcança o banco já é dono de tudo. É trocado em
 * `/auth/launcher`, que só aceita passe: se aceitasse refresh token comum, qualquer pessoa com
 * conta na instância mandaria um link `#entrar=<o token dela>` e jogaria quem o abrisse na conta dela.
 *
 * <b>Sempre adota.</b> Mesmo com sessão guardada: a guardada pode estar morta (refresh vencido,
 * revogado) sem que nada aqui saiba antes do primeiro 401 — e aí a pessoa cairia no login com um
 * passe bom nas mãos. A anterior, se for da mesma conta, é aposentada no servidor, para não sobrar
 * sessão órfã; de outra conta, não é desta janela decidir encerrá-la.
 *
 * <b>Dentro do mesmo lock da renovação.</b> Trocar a sessão enquanto outra janela renova a
 * anterior faria a renovação dela dar 401 e limpar o armazenamento — deslogando todas. No lock,
 * quem vem depois relê e já encontra a sessão nova.
 */
export class LauncherLogin {
  static readonly PARAM = 'entrar'

  /** Vale para a primeira tela desta carga: volta a `none` assim que a sessão muda. */
  outcome: LauncherOutcome = 'none'
  /** Resolve quando o passe (se houver) terminou de virar sessão. Nunca rejeita. */
  ready: Promise<void> = Promise.resolve()

  constructor(
    private readonly auth: Pick<AuthResource, 'launcher' | 'revoke'>,
    private readonly sessions: SessionStore,
    private readonly locks: Locks | undefined = typeof navigator !== 'undefined' ? navigator.locks : undefined,
    private readonly timeoutMs = 10_000,
  ) {}

  /**
   * Tira o passe da URL e começa a troca. Precisa rodar ANTES de o roteador ser criado: ele lê o
   * endereço uma vez, na criação, e um passe que chegasse até ele iria parar no `?redirect=` do
   * login — e daí no histórico de navegação.
   */
  start(address: Address): Promise<void> {
    const ticket = LauncherLogin.take(address)
    if (ticket) this.ready = this.adopt(ticket)
    return this.ready
  }

  /** Lê `entrar` do fragmento e o remove, preservando o resto do endereço e o `history.state`. */
  private static take({ location, history }: Address): string | null {
    const params = new URLSearchParams(location.hash.slice(1))
    if (!params.has(LauncherLogin.PARAM)) return null

    const ticket = params.get(LauncherLogin.PARAM)
    params.delete(LauncherLogin.PARAM)
    const rest = params.toString()
    history.replaceState(history.state, '', location.pathname + location.search + (rest ? `#${rest}` : ''))
    return ticket || null
  }

  private async adopt(ticket: string): Promise<void> {
    // O prazo conta desde já, e não só depois do lock: uma renovação lenta em outra janela também
    // deixaria esta em branco, já que o app só monta depois do passe.
    const signal = AbortSignal.timeout(this.timeoutMs)
    try {
      this.outcome = await (this.locks
        ? this.locks.request(SESSION_LOCK, { signal }, () => this.exchange(ticket, signal))
        : this.exchange(ticket, signal))
    } catch {
      // Rede, prazo estourado ou lock indisponível: fica a sessão que houver.
      this.outcome = 'offline'
    }
    // O aviso de falha é sobre esta chegada. Entrou ou saiu depois, ele já não diz nada.
    const unsubscribe = this.sessions.subscribe(() => {
      this.outcome = 'none'
      unsubscribe()
    })
  }

  private async exchange(ticket: string, signal: AbortSignal): Promise<LauncherOutcome> {
    // Lida aqui dentro, e não antes do lock: outra janela pode ter renovado enquanto esperávamos.
    const previous = this.sessions.reload()
    const session = await this.auth.launcher(ticket, signal)
    if (!session) return 'rejected'

    this.sessions.set(session)
    if (previous && previous.userId === session.userId && previous.refreshToken !== session.refreshToken) {
      void this.auth.revoke(previous.refreshToken)
    }
    return 'ok'
  }
}
