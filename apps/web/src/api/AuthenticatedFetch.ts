import type { ServerKeyStore } from './ServerKeyStore'
import type { SessionStore } from './SessionStore'
import type { Session } from './types'

/** Troca um refresh token por uma sessão nova. `null` = o servidor recusou; lança em falha de rede. */
export type Refresher = (refreshToken: string) => Promise<Session | null>

/**
 * O `fetch` que o cliente autenticado usa: põe o Bearer, renova a sessão quando precisa e repete
 * o pedido uma vez depois de renovar.
 *
 * <b>Uma renovação por vez — nesta aba e entre abas.</b> O refresh token é rotativo: renovar
 * consome o antigo. Se a tela inicial dispara quatro consultas com o token vencido e cada uma
 * renovasse por conta própria, a primeira ganharia e as outras três apresentariam um token já
 * consumido — e a pessoa seria deslogada por ter aberto a página. Aqui as quatro esperam a mesma
 * promessa. Entre abas, o Web Locks serializa, e quem chega depois relê a sessão que a outra aba
 * acabou de gravar em vez de renovar de novo.
 */
export class AuthenticatedFetch {
  private inFlight: Promise<Session | null> | null = null

  constructor(
    private readonly sessions: SessionStore,
    private readonly serverKey: ServerKeyStore,
    private readonly refresher: Refresher,
    private readonly transport: (request: Request) => Promise<Response> = (request) => globalThis.fetch(request),
  ) {}

  readonly fetch = async (request: Request): Promise<Response> => {
    let session = this.sessions.session
    if (session && this.sessions.expiresSoon(session)) session = await this.renew(session)

    // O corpo de um Request só pode ser lido uma vez; a cópia é para a eventual segunda tentativa.
    const retry = request.clone()
    const response = await this.transport(this.decorate(request, session))
    if (response.status !== 401 || !session) return response

    const renewed = await this.renew(session)
    return renewed ? this.transport(this.decorate(retry, renewed)) : response
  }

  private decorate(request: Request, session: Session | null): Request {
    this.serverKey.apply(request.headers)
    if (session) request.headers.set('Authorization', `Bearer ${session.accessToken}`)
    return request
  }

  private renew(stale: Session): Promise<Session | null> {
    this.inFlight ??= this.renewAcrossTabs(stale).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async renewAcrossTabs(stale: Session): Promise<Session | null> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (!locks) return this.renewNow(stale)
    return await locks.request('reprise:refresh', () => this.renewNow(stale))
  }

  private async renewNow(stale: Session): Promise<Session | null> {
    const latest = this.sessions.reload()
    if (!latest) return null

    // Outra aba renovou enquanto esperávamos o lock: é só adotar.
    if (latest.refreshToken !== stale.refreshToken && !this.sessions.expiresSoon(latest)) return latest

    const renewed = await this.refresher(latest.refreshToken)
    if (renewed) this.sessions.set(renewed)
    else this.sessions.clear()
    return renewed
  }
}
