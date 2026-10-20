import { beforeEach, describe, expect, it } from 'vitest'
import { AppMode } from './AppMode'

/** Uma janela de mentira com o que o AppMode lê: o `display-mode`, o Safari e o referrer. */
function fakeWindow({ displayMode = 'browser', standalone, referrer = '' }: { displayMode?: string; standalone?: boolean; referrer?: string } = {}) {
  return {
    matchMedia: (query: string) => ({ matches: query === `(display-mode: ${displayMode})` }),
    navigator: { standalone },
    document: { referrer },
    sessionStorage: window.sessionStorage,
  } as unknown as Window
}

describe('AppMode', () => {
  beforeEach(() => sessionStorage.clear())

  it('no navegador comum, não é o app', () => {
    expect(AppMode.isInstalled(fakeWindow())).toBe(false)
  })

  it('PWA instalada (display-mode standalone) é o app', () => {
    expect(AppMode.isInstalled(fakeWindow({ displayMode: 'standalone' }))).toBe(true)
  })

  it('tela de início do Safari, que não fala display-mode, é o app', () => {
    expect(AppMode.isInstalled(fakeWindow({ standalone: true }))).toBe(true)
  })

  it('o APK abre com referrer android-app://, e a descoberta sobrevive à recarga da aba', () => {
    expect(AppMode.isInstalled(fakeWindow({ referrer: 'android-app://io.github.gabrielfsilveiradev.reprise/' }))).toBe(true)
    // Recarregou: o referrer se perdeu, mas a aba ainda é a do app.
    expect(AppMode.isInstalled(fakeWindow())).toBe(true)
  })

  it('sem janela (renderização fora do navegador), não é o app', () => {
    expect(AppMode.isInstalled(undefined)).toBe(false)
  })
})
