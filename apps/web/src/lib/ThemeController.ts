import { SafeStorage } from './SafeStorage'

export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * Claro, escuro ou "o do sistema". O script do index.html aplica o tema antes do primeiro pixel;
 * daqui em diante é esta classe que mantém o `data-theme` do <html> — inclusive quando o sistema
 * troca sozinho ao anoitecer e a preferência é "sistema".
 */
export class ThemeController {
  static readonly KEY = 'reprise.theme'

  private readonly listeners = new Set<() => void>()
  private readonly media: MediaQueryList | null

  constructor(private readonly storage: SafeStorage = new SafeStorage()) {
    this.media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    this.media?.addEventListener('change', () => this.apply())
  }

  get preference(): ThemePreference {
    const saved = this.storage.get(ThemeController.KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  }

  get resolved(): 'light' | 'dark' {
    const pref = this.preference
    if (pref !== 'system') return pref
    return this.media?.matches ? 'dark' : 'light'
  }

  set(preference: ThemePreference): void {
    if (preference === 'system') this.storage.remove(ThemeController.KEY)
    else this.storage.set(ThemeController.KEY, preference)
    this.apply()
  }

  apply(): void {
    document.documentElement.dataset.theme = this.resolved
    for (const listener of this.listeners) listener()
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): ThemePreference => this.preference
}

export const theme = new ThemeController()
