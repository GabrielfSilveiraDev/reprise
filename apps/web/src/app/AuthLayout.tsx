import { Outlet } from '@tanstack/react-router'
import { Logo } from '@/ui/Logo'

/**
 * Moldura das telas de entrada: o formulário de um lado e, no desktop, uma "fita" de episódios do
 * outro — a grade que o app usa para mostrar o que você viu, aqui como assinatura visual.
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
        <p className="text-xs text-ink-3">Uma exibição é um evento, não um booleano.</p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:block" aria-hidden>
        <AuthArt />
      </div>
    </div>
  )
}

/** Uma grade de temporadas fictícias — a linguagem do mapa de episódios. */
function AuthArt() {
  // Determinístico: a mesma "série" a cada visita. Níveis 0–4 como no mapa real.
  const rows = [
    [3, 3, 2, 3, 4, 3, 2, 2, 3, 3],
    [2, 2, 2, 1, 2, 3, 2, 2, 2, 2, 1, 2],
    [1, 1, 2, 1, 1, 1, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0],
    [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, -1, -1, -1],
  ]
  const tone = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4']
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-10 p-16">
      <div className="max-w-md">
        <p className="eyebrow">Seu diário de séries</p>
        <p className="headline mt-3 text-5xl text-balance">Cada vez que você volta a uma série conta.</p>
        <p className="mt-4 text-ink-2">
          O Reprise guarda cada exibição com data — a primeira vez, a maratona de 2021 e a revisão de ontem.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, r) => (
          <div key={r} className="flex items-center gap-2">
            <span className="code w-8 text-xs text-ink-3">T{r + 1}</span>
            {row.map((level, c) => (
              <span
                key={c}
                className={
                  level < 0
                    ? 'size-7 rounded-md border border-dashed border-line-strong'
                    : `size-7 rounded-md ${tone[level]} ${r === 3 && c === 5 ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
