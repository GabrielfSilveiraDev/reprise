import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Kbd } from '@/ui/Controls'
import { Logo } from '@/ui/Logo'
import { NAV, navActive, type ShellFrame } from './useShellFrame'

/**
 * A moldura da Sessão: um letreiro no alto, discreto, e a tela livre para os pôsteres. No
 * desktop, os destinos são palavras no topo, sublinhadas de dourado quando ativas; no celular,
 * uma doca flutuante embaixo, que deixa o conteúdo correr por trás.
 */
export function ShellSessao({ frame, children }: { frame: ShellFrame; children: ReactNode }) {
  const { initials, openPalette } = frame

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-6 px-4 sm:px-6 lg:h-16 lg:px-10">
          <Link to="/" aria-label="Reprise — Agora" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Principal" className="mx-auto hidden items-center gap-8 lg:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                activeOptions={navActive(to)}
                className="relative py-2 text-[15px] text-ink-3 transition-colors hover:text-ink data-[status=active]:text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:scale-x-0 after:bg-accent after:transition-transform data-[status=active]:after:scale-x-100"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <button
              type="button"
              onClick={openPalette}
              aria-label="Buscar"
              className="flex h-9 items-center gap-2 rounded-control border border-line px-3 text-sm text-ink-3 transition-colors hover:border-line-strong hover:text-ink lg:w-56"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden flex-1 text-left lg:inline">Buscar</span>
              <span className="hidden lg:inline">
                <Kbd>Ctrl K</Kbd>
              </span>
            </button>
            <Link
              to="/buscar"
              aria-label="Adicionar série"
              className="hidden size-9 place-items-center rounded-full border border-line text-ink-3 transition-colors hover:border-accent hover:text-accent-ink lg:grid"
            >
              <Plus className="size-4" />
            </Link>
            <Link
              to="/conta"
              aria-label="Conta e dados"
              className="grid size-9 place-items-center rounded-full border border-accent/50 font-display text-base text-accent-ink italic transition-colors hover:bg-accent-soft data-[status=active]:bg-accent-soft"
            >
              {initials}
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-36 sm:px-6 lg:px-10 lg:pt-10 lg:pb-20">
        {children}
      </main>

      {/* ---------- Doca (celular) ---------- */}
      <nav aria-label="Principal" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 rounded-[1.75rem] border border-line bg-surface/85 p-1 shadow-pop backdrop-blur-xl">
          {[...NAV, { to: '/buscar' as const, label: 'Buscar', icon: Search }].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/', includeSearch: false }}
              className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[1.4rem] text-[11px] text-ink-3 transition-colors data-[status=active]:bg-surface-3 data-[status=active]:text-ink"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
