import type { DesignId } from './DesignController'

/**
 * Se o Reprise está rodando como o app instalado — pela tela inicial do celular (PWA) ou pelo APK
 * do Android (uma Trusted Web Activity, que é este mesmo site aberto pelo Chrome em tela cheia).
 *
 * O app tem um design só, a Brasa: é a identidade do ícone e da tela de abertura, e um app que
 * troca de cara inteira dentro de Conta confunde mais do que ajuda. No navegador os três designs
 * continuam à escolha.
 *
 * Os sinais, do mais comum ao mais raro:
 *  - `display-mode` diferente de `browser`: a PWA instalada (e o APK, no Chrome atual);
 *  - `navigator.standalone`: o "Adicionar à Tela de Início" do Safari, que não fala `display-mode`;
 *  - referrer `android-app://`: o APK, na primeira página que ele abre.
 * O último só vale na abertura — uma recarga perde o referrer —, por isso a descoberta fica
 * guardada na sessão da aba: ela dura enquanto o app estiver aberto, e nasce de novo a cada abertura.
 */
export class AppMode {
  static readonly DESIGN: DesignId = 'brasa'
  static readonly SESSION_KEY = 'reprise.app'

  static isInstalled(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
    if (!win) return false

    const standalone = ['standalone', 'fullscreen', 'minimal-ui'].some(
      (mode) => win.matchMedia?.(`(display-mode: ${mode})`).matches === true,
    )
    const safariHomeScreen = (win.navigator as Navigator & { standalone?: boolean }).standalone === true
    const androidApp = win.document.referrer.startsWith('android-app://')

    if (standalone || safariHomeScreen || androidApp) {
      AppMode.remember(win)
      return true
    }
    return AppMode.remembered(win)
  }

  private static remember(win: Window): void {
    try {
      win.sessionStorage.setItem(AppMode.SESSION_KEY, '1')
    } catch {
      /* sem armazenamento: vale só para esta carga */
    }
  }

  private static remembered(win: Window): boolean {
    try {
      return win.sessionStorage.getItem(AppMode.SESSION_KEY) === '1'
    } catch {
      return false
    }
  }
}
