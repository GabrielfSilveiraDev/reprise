import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Fmt } from '@/lib/format'
import { Logo } from '@/ui/Logo'
import { NAV, navActive, type ShellFrame } from './useShellFrame'

/**
 * A moldura da Grade: a faixa de transmissão (dia e hora, como no canto de um canal) e, embaixo,
 * as abas numeradas separadas por fios. A aba ativa é invertida — tinta no papel. No celular, as
 * mesmas abas vão para baixo, com os números.
 */
export function ShellGrade({ frame, children }: { frame: ShellFrame; children: ReactNode }) {
  const { initials, openPalette } = frame

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b-2 border-line-strong bg-bg">
        <div className="bg-ink text-bg">
          <div className="code mx-auto flex h-8 max-w-[1280px] items-center justify-between gap-4 px-4 text-[11px] tracking-wide uppercase sm:px-6 lg:px-10">
            <span className="truncate">Reprise · diário de séries</span>
            <OnAirClock />
          </div>
        </div>

        <div className="mx-auto flex h-14 max-w-[1280px] items-stretch px-4 sm:px-6 lg:px-10">
          <Link to="/" aria-label="Reprise — Agora" className="flex items-center pr-5 lg:border-r lg:border-line-strong">
            <Logo />
          </Link>

          <nav aria-label="Principal" className="hidden lg:flex">
            {NAV.map(({ to, label }, i) => (
              <Link
                key={to}
                to={to}
                activeOptions={navActive(to)}
                className="group flex items-center gap-2 border-r border-line-strong px-5 text-sm font-semibold transition-colors hover:bg-surface-2 data-[status=active]:bg-ink data-[status=active]:text-bg"
              >
                <span className="code text-[11px] font-normal text-ink-3 group-data-[status=active]:text-bg/70">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-stretch">
            <button
              type="button"
              onClick={openPalette}
              aria-label="Buscar"
              className="flex items-center gap-3 px-3 text-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:w-64 lg:border-l lg:border-line-strong lg:px-4"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden flex-1 text-left lg:inline">Buscar série</span>
              <span className="code hidden border border-line-strong px-1.5 text-[10px] lg:inline">/</span>
            </button>
            <Link
              to="/buscar"
              aria-label="Adicionar série"
              className="hidden items-center border-l border-line-strong px-4 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:flex"
            >
              <Plus className="size-4" />
            </Link>
            <Link
              to="/conta"
              aria-label="Conta e dados"
              className="flex items-center pl-3 lg:border-l lg:border-line-strong lg:pl-4"
            >
              <span className="code grid size-8 place-items-center bg-ink text-xs font-semibold text-bg">{initials}</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-32 sm:px-6 lg:px-10 lg:pt-12 lg:pb-20">
        {children}
      </main>

      {/* ---------- Abas (celular) ---------- */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line-strong bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {[...NAV, { to: '/buscar' as const, label: 'Buscar' }].map(({ to, label }, i) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/', includeSearch: false }}
              className="group flex h-16 flex-col items-center justify-center gap-1 border-r border-line text-[11px] font-semibold last:border-r-0 data-[status=active]:bg-ink data-[status=active]:text-bg"
            >
              <span className="code text-[10px] font-normal text-ink-3 group-data-[status=active]:text-bg/70">{String(i + 1).padStart(2, '0')}</span>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Dia e hora no canto, como na tela de um canal. Atualiza na virada de cada minuto. */
function OnAirClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="shrink-0" aria-hidden>
      {Fmt.pattern(now, 'EEE dd.MM')} · {Fmt.time(now)}
    </span>
  )
}
