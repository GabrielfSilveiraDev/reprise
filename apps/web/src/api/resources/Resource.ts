import type { Client } from 'openapi-fetch'
import { ApiError, NetworkError } from '../ApiError'
import type { paths } from '../schema'

export type Http = Client<paths>

interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/**
 * Base dos recursos: cada subclasse agrupa as rotas de um assunto e devolve o DTO já
 * desembrulhado — ou lança `ApiError`/`NetworkError`. As telas nunca veem `{ data, error }`.
 */
export abstract class Resource {
  constructor(protected readonly http: Http) {}

  protected async call<T>(request: Promise<FetchResult<T>>): Promise<T> {
    let result: FetchResult<T>
    try {
      result = await request
    } catch (cause) {
      throw new NetworkError(cause)
    }
    if (!result.response.ok) throw ApiError.from(result.response.status, result.error)
    return result.data as T
  }
}

/**
 * Chave de idempotência por ação. A API aceita `clientKey` para que uma retentativa não vire
 * um rewatch fantasma. `crypto.randomUUID` só existe em contexto seguro (https ou localhost) —
 * aberto pelo IP da rede de casa, no celular, ele some; daí o plano B com getRandomValues.
 */
export class ClientKey {
  static create(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}
