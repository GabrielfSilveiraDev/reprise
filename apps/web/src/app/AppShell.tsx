import { Link, Outlet, useRouter } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { CalendarDays, ChartColumn, LibraryBig, Play, Search } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { api } from '@/api/RepriseApi'
import { CommandPalette } from '@/features/search/CommandPalette'
import { Kbd } from '@/ui/Controls'
import { Logo, LogoMark } from '@/ui/Logo'
import { initialsOf, useSession } from './useSession'

type NavTarget = '/' | '/acervo' | '/agenda' | '/numeros' | '/buscar'

const NAV: { to: NavTarget; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: '/', label: 'Agora', icon: Play },
  { to: '/acervo', label: 'Acervo', icon: LibraryBig },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/numeros', label: 'Números', icon: ChartColumn },
]

/**
 * A moldura de quem está logado. No desktop, barra lateral; no celular, abas embaixo, ao alcance
 * do polegar, e o acervo e a busca a um toque. A mesma árvore de rotas nos dois — só a navegação
 * muda de lugar.
 */
export function AppShell() {
  const session = useSession()
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Sessão encerrada: volta para o login. Se ela caiu sozinha (refresh recusado, saiu em outra
  // aba), lembra onde a pessoa estava; se ela clicou em Sair, não. O endereço é lido na hora, e
  // não é dependência do efeito — senão cada navegação dispararia outra.
  useEffect(() => {
    if (session) return
    const redirect = api.sessions.endedBy === 'logout' ? undefined : router.state.location.href
    void router.navigate({ to: '/entrar', search: { redirect }, replace: true })
  }, [session, router])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!session) return null
  const initials = initialsOf(session.displayName)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>

      {/* ---------- Barra lateral (desktop) ---------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line px-4 py-6 lg:flex">
        <Link to="/" className="px-2" aria-label="Reprise — Agora">
          <Logo />
        </Link>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Buscar série…</span>
          <Kbd>Ctrl K</Kbd>
        </button>

        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/', includeSearch: false }}
              className="group flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink data-[status=active]:bg-surface data-[status=active]:text-ink data-[status=active]:shadow-sm"
            >
              <Icon className="size-[18px] text-ink-3 group-data-[status=active]:text-accent" />
              {label}
            </Link>
          ))}
          <Link
            to="/buscar"
            className="group flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink data-[status=active]:bg-surface data-[status=active]:text-ink data-[status=active]:shadow-sm"
          >
            <Search className="size-[18px] text-ink-3 group-data-[status=active]:text-accent" />
            Adicionar série
          </Link>
        </nav>

        <Link
          to="/conta"
          className="mt-auto flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-2 data-[status=active]:bg-surface"
        >
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{session.displayName}</span>
            <span className="block truncate text-xs text-ink-3">Conta e dados</span>
          </span>
        </Link>
      </aside>

      <div className="min-w-0">
        {/* ---------- Topo (celular) ---------- */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md lg:hidden">
          <Link to="/" aria-label="Reprise — Agora" className="flex items-center gap-2">
            <LogoMark className="size-7" />
            <span className="headline text-xl">reprise</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buscar"
              className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
            >
              <Search className="size-5" />
            </button>
            <Link to="/conta" aria-label="Conta" className="grid size-10 place-items-center">
              <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">{initials}</span>
            </Link>
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <Outlet />
        </main>
      </div>

      {/* ---------- Abas (celular) ---------- */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {[...NAV, { to: '/buscar' as const, label: 'Buscar', icon: Search }].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/', includeSearch: false }}
              className={clsx(
                'group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-3',
                'data-[status=active]:text-ink',
              )}
            >
              <span className="grid h-7 w-12 place-items-center rounded-full transition-colors group-data-[status=active]:bg-accent-soft">
                <Icon className="size-5 group-data-[status=active]:text-accent-ink" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
