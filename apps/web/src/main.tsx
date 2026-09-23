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
import { design } from './lib/DesignController'
import { theme } from './lib/ThemeController'
import { TooltipProvider } from './ui/Controls'

// Ao sair (aqui ou em outra aba), o cache de dados da pessoa vai junto: quem entrar depois
// neste navegador não pode ver, nem por um instante, o acervo de quem saiu.
api.sessions.subscribe(() => {
  if (!api.sessions.session) queryClient.clear()
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <ThemedToaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
