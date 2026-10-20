import { registerSW } from 'virtual:pwa-register'

/**
 * O service worker do app instalável (vite-plugin-pwa), e como uma versão nova chega a quem já
 * tem o Reprise aberto.
 *
 * O worker guarda a casca do app (HTML, JS, CSS, ícones) para abrir na hora, mesmo com o servidor
 * dormindo — o plano gratuito do Render leva um minuto para acordar, e a tela já aparece enquanto
 * isso. Os dados nunca passam por ele: tudo em `/api` vai direto à rede, sempre fresco.
 *
 * Atualização sem pedir nada (`autoUpdate`): cada deploy gera um worker novo, que assume assim que
 * é baixado e recarrega a página. O navegador confere ao abrir; e, como o app fica aberto em
 * segundo plano no celular, conferimos também quando a pessoa volta a ele — é o momento natural
 * para a recarga, antes de ela começar a mexer em alguma coisa.
 */
export class AppUpdates {
  static start(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) void registration.update()
        })
      },
    })
  }
}
