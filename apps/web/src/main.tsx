// As fontes dos três designs. Registrar um @font-face não baixa nada: o navegador só busca o
// arquivo de uma fonte quando alguma coisa na tela a usa — quem está na Brasa não paga pela Geist.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/bricolage-grotesque/standard.css'
import '@fontsource/instrument-serif'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/instrument-sans/standard.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { api } from './api/RepriseApi'
import { queryClient, router } from './app/router'
import { AppUpdates } from './lib/AppUpdates'
import { design } from './lib/DesignController'
import { theme } from './lib/ThemeController'
import { TooltipProvider } from './ui/Controls'

// Quando a pessoa muda — saiu (aqui ou em outra aba), ou o passe do launcher entrou com outra
// conta —, o cache de dados vai junto: quem entra depois não pode ver, nem por um instante, o
// acervo de quem estava antes. Renovar a sessão da mesma pessoa não conta como troca.
let currentUser = api.sessions.session?.userId
api.sessions.subscribe(() => {
  const next = api.sessions.session?.userId
  if (next !== currentUser) queryClient.clear()
  currentUser = next
})

// A barra do navegador no celular acompanha o fundo do design e do tema em uso. Lido da variável,
// e não de uma tabela, para não existir um segundo lugar com as cores.
const paintBrowserChrome = () => {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}
theme.subscribe(paintBrowserChrome)
design.subscribe(paintBrowserChrome)

theme.apply()
design.apply()
AppUpdates.start()

function ThemedToaster() {
  const resolved = useSyncExternalStore(theme.subscribe, () => theme.resolved)
  return (
    <Toaster
      theme={resolved}
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        classNames: {
          toast: '!rounded-panel !border-line !bg-surface !text-ink !shadow-pop !font-sans grade:!border-line-strong',
          description: '!text-ink-3',
          actionButton: '!bg-accent !text-accent-fg !rounded-control-sm !font-semibold',
        },
      }}
    />
  )
}

// O app só monta depois de o passe do launcher (se a página veio dele) virar sessão: é ao montar
// que o roteador decide entre o login e o app. Sem passe, `ready` já está resolvida.
void api.launcherLogin.ready.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          <ThemedToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>,
  ),
)
