import { SafeStorage } from '@/lib/SafeStorage'

/**
 * A chave do "cadeado de acesso" da API (`Api__AccessToken`), enviada em `X-Reprise-Token`.
 *
 * Não é login: é a porta do prédio, ligada só quando a API sai da rede de casa. Quando ela está
 * ligada, NADA responde sem a chave — nem a tela de login —, então ela precisa ser guardada à
 * parte da sessão e sobreviver ao logout.
 */
export class ServerKeyStore {
  static readonly KEY = 'reprise.server-key'
  static readonly HEADER = 'X-Reprise-Token'

  constructor(private readonly storage: SafeStorage = new SafeStorage()) {}

  get value(): string | null {
    return this.storage.get(ServerKeyStore.KEY)
  }

  set(value: string): void {
    const trimmed = value.trim()
    if (trimmed) this.storage.set(ServerKeyStore.KEY, trimmed)
    else this.clear()
  }

  clear(): void {
    this.storage.remove(ServerKeyStore.KEY)
  }

  /** Acrescenta o cabeçalho quando há chave. Não mexe no pedido quando não há. */
  apply(headers: Headers): void {
    const key = this.value
    if (key) headers.set(ServerKeyStore.HEADER, key)
  }
}
