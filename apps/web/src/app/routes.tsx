import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, Outlet, redirect } from '@tanstack/react-router'
import { api } from '@/api/RepriseApi'
import { AppShell } from './AppShell'
import { AuthLayout } from './AuthLayout'
import { NotFound } from './NotFound'

export interface RouterContext {
  queryClient: QueryClient
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
})

/** Telas de entrada. Quem já tem sessão vai direto para dentro. */
export const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_public',
  beforeLoad: () => {
    if (api.sessions.session) throw redirect({ to: '/' })
  },
  component: AuthLayout,
})

/** Tudo o que mostra dado de alguém. Sem sessão, vai para o login e volta para onde estava. */
export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: ({ location }) => {
    if (!api.sessions.session) {
      throw redirect({ to: '/entrar', search: { redirect: location.href === '/' ? undefined : location.href } })
    }
  },
  component: AppShell,
})
