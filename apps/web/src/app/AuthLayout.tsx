import { Outlet } from '@tanstack/react-router'
import { useDesigned } from '@/lib/useDesign'
import { Logo } from '@/ui/Logo'

/**
 * Moldura das telas de entrada: o formulário de um lado e, no desktop, a assinatura visual do
 * design do outro — a grade de temporadas (Brasa), o programa da sessão (Sessão), a grade de
 * horários (Grade). O design vem do navegador, então vale antes mesmo de entrar.
 */
export function AuthLayout() {
  const art = useDesigned({ brasa: <ArtBrasa />, sessao: <ArtSessao />, grade: <ArtGrade /> })
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

      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:block grade:border-l-2 grade:border-line-strong" aria-hidden>
        {art}
      </div>
    </div>
  )
}

/** Brasa: uma grade de temporadas fictícias — a linguagem do mapa de episódios. */
function ArtBrasa() {
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

/** Sessão: o programa impresso de uma noite de revisões, com a borda perfurada de um filme. */
function ArtSessao() {
  const program = [
    ['20:00', 'Farol do Norte', 'T1 · E1', 'terceira vez'],
    ['20:50', 'Farol do Norte', 'T1 · E2', 'terceira vez'],
    ['21:40', 'Casa de Vidro', 'T2 · E7', 'primeira vez'],
    ['22:30', 'Linha Vermelha', 'T4 · E6', 'o final, de novo'],
  ]
  const sprockets = 'bg-[length:28px_100%] bg-[linear-gradient(90deg,var(--c-surface-3)_0_14px,transparent_14px_28px)]'
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-12 bg-bg p-16">
      <div className={`absolute inset-x-0 top-6 h-3 ${sprockets}`} />
      <div className={`absolute inset-x-0 bottom-6 h-3 ${sprockets}`} />
      <div className="max-w-lg">
        <p className="eyebrow">Programa da noite</p>
        <p className="headline mt-4 text-6xl text-balance italic">Toda série merece uma segunda sessão.</p>
      </div>
      <ol className="max-w-lg divide-y divide-line border-y border-line">
        {program.map(([time, name, code, note]) => (
          <li key={time} className="flex items-baseline gap-5 py-3.5">
            <span className="code w-12 shrink-0 text-sm text-accent-ink">{time}</span>
            <span className="headline flex-1 text-2xl">{name}</span>
            <span className="text-right text-xs text-ink-3">
              <span className="code block text-ink-2">{code}</span>
              {note}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Grade: uma grade de horários de canal, com a faixa "no ar" na linha de agora. */
function ArtGrade() {
  const slots = [
    ['19:00', 'Maré Alta', 'S03E04', false],
    ['19:45', 'Os Arquivistas', 'S02E01', false],
    ['20:30', 'Farol do Norte', 'S03E06', true],
    ['21:15', 'Terra Firme', 'S02E04', false],
    ['22:00', 'Expresso Oriente', 'S01E10', false],
  ] as const
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-10 p-16">
      <div className="max-w-md">
        <p className="eyebrow">Programação · hoje</p>
        <p className="headline mt-3 text-6xl">Sua grade. Seus horários.</p>
      </div>
      <ol className="max-w-lg border-t-2 border-line-strong">
        {slots.map(([time, name, code, live]) => (
          <li key={time} className={`grid grid-cols-[4rem_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-line-strong px-2 py-3 ${live ? 'bg-accent text-accent-fg' : ''}`}>
            <span className="code text-sm font-semibold">{time}</span>
            <span className="truncate text-lg font-semibold tracking-tight">{name}</span>
            <span className="code text-xs">{live ? 'NO AR · ' : ''}{code}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
