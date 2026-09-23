import { QueryClient } from '@tanstack/react-query'
import { createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router'
import { ApiError } from '@/api/ApiError'
import { Queries } from '@/api/queries'
import { LIBRARY_FILTERS, LIBRARY_SORTS, type LibraryFilter, type LibrarySort } from '@/domain/LibraryView'
import { ConfirmPage } from '@/features/auth/ConfirmPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { HomePage } from '@/features/home/HomePage'
import { SearchParams as P } from '@/lib/SearchParams'
import { appRoute, publicRoute, rootRoute } from './routes'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erro 4xx é resposta, não acidente: repetir não muda nada. Rede e 5xx merecem mais uma.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
})

/* ---------- Entrada ---------- */

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: '/entrar',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: P.text(s.redirect) }),
  component: LoginPage,
})

const registerRoute = createRoute({ getParentRoute: () => publicRoute, path: '/criar-conta', component: RegisterPage })

const confirmRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: '/confirmar',
  validateSearch: (s: Record<string, unknown>): { email?: string; enviado?: boolean } => ({ email: P.text(s.email), enviado: P.flag(s.enviado) }),
  component: ConfirmPage,
})

/* ---------- App ---------- */
// Telas fora da inicial chegam sob demanda (Números traz o Recharts, que é metade do peso);
// com o preload por intenção, o pedaço já vem ao passar o mouse no link.
// Os loaders só PRÉ-BUSCAM (sem await): com `defaultPreload: 'intent'`, passar o mouse num link
// já traz os dados, e a tela abre com eles; se não deu tempo, ela mostra o esqueleto.

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(Queries.nextUp())
    void context.queryClient.prefetchQuery(Queries.premieres())
  },
  component: HomePage,
})

const libraryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/acervo',
  validateSearch: (s: Record<string, unknown>): { estado?: LibraryFilter; ordem?: LibrarySort; q?: string } => ({
    estado: P.oneOf(s.estado, LIBRARY_FILTERS),
    ordem: P.oneOf(s.ordem, LIBRARY_SORTS),
    q: P.text(s.q),
  }),
  loader: ({ context }) => void context.queryClient.prefetchQuery(Queries.seriesList()),
  component: lazyRouteComponent(() => import('@/features/library/LibraryPage'), 'LibraryPage'),
})

const seriesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/serie/$seriesId',
  params: {
    parse: (p: { seriesId: string }) => ({ seriesId: Number(p.seriesId) }),
    stringify: (p: { seriesId: number }) => ({ seriesId: String(p.seriesId) }),
  },
  validateSearch: (s: Record<string, unknown>): { ep?: number } => ({ ep: P.int(s.ep) }),
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(Queries.seriesDetail(params.seriesId)),
  component: lazyRouteComponent(() => import('@/features/series/SeriesPage'), 'SeriesPage'),
})

const agendaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/agenda',
  validateSearch: (s: Record<string, unknown>): { estreias?: boolean } => ({ estreias: P.flag(s.estreias) }),
  loader: ({ context }) => void context.queryClient.prefetchQuery(Queries.premieres()),
  component: lazyRouteComponent(() => import('@/features/agenda/AgendaPage'), 'AgendaPage'),
})

const statsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/numeros',
  validateSearch: (s: Record<string, unknown>): { ano?: number; lote?: boolean } => ({ ano: P.int(s.ano), lote: P.flag(s.lote) }),
  component: lazyRouteComponent(() => import('@/features/stats/StatsPage'), 'StatsPage'),
})

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/buscar',
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({ q: P.text(s.q) }),
  component: lazyRouteComponent(() => import('@/features/search/SearchPage'), 'SearchPage'),
})

const accountRoute = createRoute({ getParentRoute: () => appRoute, path: '/conta', component: lazyRouteComponent(() => import('@/features/account/AccountPage'), 'AccountPage') })

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([loginRoute, registerRoute, confirmRoute]),
  appRoute.addChildren([homeRoute, libraryRoute, seriesRoute, agendaRoute, statsRoute, searchRoute, accountRoute]),
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // O cache é do React Query; o roteador não guarda cópia própria.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
