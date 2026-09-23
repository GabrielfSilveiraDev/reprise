/**
 * localStorage que não derruba o app. Em janela privada, com cookies bloqueados ou em alguns
 * iframes, o acesso lança exceção — e o Reprise tem de continuar abrindo, só sem lembrar de nada.
 */
export class SafeStorage {
  constructor(private readonly backend: Storage | null = SafeStorage.detect()) {}

  get(key: string): string | null {
    try {
      return this.backend?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  set(key: string, value: string): void {
    try {
      this.backend?.setItem(key, value)
    } catch {
      /* sem armazenamento: vale para esta aba e pronto */
    }
  }

  remove(key: string): void {
    try {
      this.backend?.removeItem(key)
    } catch {
      /* idem */
    }
  }

  getJson<T>(key: string): T | null {
    const raw = this.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private static detect(): Storage | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage
    } catch {
      return null
    }
  }
}
