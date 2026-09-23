import createClient from 'openapi-fetch'
import { SafeStorage } from '@/lib/SafeStorage'
import { AuthenticatedFetch } from './AuthenticatedFetch'
import { AuthResource } from './resources/AuthResource'
import {
  AccountResource,
  ScheduleResource,
  SeriesResource,
  StatsResource,
  WatchingResource,
} from './resources/LibraryResources'
import type { paths } from './schema'
import { ServerKeyStore } from './ServerKeyStore'
import { SessionStore } from './SessionStore'

/**
 * Raiz de composição do cliente: monta os dois clientes HTTP (com e sem Bearer) e os recursos.
 *
 * Um objeto só, criado uma vez, porque sessão e renovação são estado compartilhado — dois
 * `AuthenticatedFetch` renovariam em paralelo, que é exatamente o que ele existe para impedir.
 */
export class RepriseApi {
  readonly sessions: SessionStore
  readonly serverKey: ServerKeyStore
  readonly auth: AuthResource
  readonly series: SeriesResource
  readonly watching: WatchingResource
  readonly schedule: ScheduleResource
  readonly stats: StatsResource
  readonly account: AccountResource

  constructor(baseUrl: string = import.meta.env.VITE_API_URL ?? '/api', storage: SafeStorage = new SafeStorage()) {
    this.sessions = new SessionStore(storage)
    this.serverKey = new ServerKeyStore(storage)

    const publicHttp = createClient<paths>({
      baseUrl,
      fetch: (request) => {
        this.serverKey.apply(request.headers)
        return globalThis.fetch(request)
      },
    })
    this.auth = new AuthResource(publicHttp, this.sessions)

    const authenticated = new AuthenticatedFetch(this.sessions, this.serverKey, (token) => this.auth.exchange(token))
    const http = createClient<paths>({ baseUrl, fetch: authenticated.fetch })

    this.series = new SeriesResource(http)
    this.watching = new WatchingResource(http)
    this.schedule = new ScheduleResource(http)
    this.stats = new StatsResource(http)
    this.account = new AccountResource(http)
  }
}

export const api = new RepriseApi()
