import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/bricolage-grotesque/standard.css'
import './styles/index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { api } from './api/RepriseApi'
import { queryClient, router } from './app/router'
import { theme } from './lib/ThemeController'
import { TooltipProvider } from './ui/Controls'

// Ao sair (aqui ou em outra aba), o cache de dados da pessoa vai junto: quem entrar depois
// neste navegador não pode ver, nem por um instante, o acervo de quem saiu.
api.sessions.subscribe(() => {
  if (!api.sessions.session) queryClient.clear()
})

theme.apply()

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
          toast: '!rounded-2xl !border-line !bg-surface !text-ink !shadow-pop',
          description: '!text-ink-3',
          actionButton: '!bg-accent !text-accent-fg !rounded-lg !font-semibold',
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
