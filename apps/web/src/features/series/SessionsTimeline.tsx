import { differenceInCalendarDays, parseISO } from 'date-fns'
import { History } from 'lucide-react'
import type { RewatchSession, SeriesDetail } from '@/api/types'
import { Duration } from '@/domain/Duration'
import { Fmt } from '@/lib/format'
import { SectionTitle } from '@/ui/PageHeader'

/**
 * "Quando" eu vi esta série — cada vez que a percorri, separada por pausas longas. A contagem por
 * episódio diz QUANTO; isto diz QUANDO, que é a pergunta do nome do app.
 *
 * A faixa no topo põe todas as vezes numa régua de tempo comum, do primeiro dia até hoje:
 * dá para ver de relance que a segunda vez foi três anos depois da primeira.
 */
export function SessionsTimeline({ series, now }: { series: SeriesDetail; now: Date }) {
  const sessions = series.sessions
  const title = sessions.length > 1 ? `Você passou por ela ${sessions.length} vezes` : 'Quando você viu'

  return (
    <section aria-labelledby="vezes">
      <SectionTitle id="vezes" title={title} hint="Cada vez é um período contínuo de exibições; uma pausa de 3 semanas ou mais começa outra." />

      {sessions.length === 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-dashed border-line-strong p-4 text-sm text-ink-2">
          <History className="mt-0.5 size-5 shrink-0 text-ink-3" />
          <p>
            {series.backfillExhibitions > 0
              ? 'Tudo o que você viu desta série veio de marcações em massa, que não têm data real — não dá para dizer quando.'
              : 'Nenhuma exibição ainda. Quando você marcar episódios, cada período aparece aqui.'}
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <Strip sessions={sessions} now={now} />
          <ol className="mt-5 divide-y divide-line">
            {[...sessions].reverse().map((s) => (
              <SessionRow key={s.ordinal} session={s} />
            ))}
          </ol>
          {series.backfillExhibitions > 0 && (
            <p className="mt-4 text-xs text-ink-3">
              {Fmt.plural(series.backfillExhibitions, 'exibição importada', 'exibições importadas')} em massa, sem data real, ficaram de fora.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function SessionRow({ session: s }: { session: RewatchSession }) {
  const start = parseISO(s.startedAt)
  const end = parseISO(s.endedAt)
  const sameDay = differenceInCalendarDays(end, start) === 0
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-baseline">
      <span className="headline row-span-2 text-xl text-accent-ink sm:row-span-1">{s.ordinal}ª vez</span>
      <span className="text-sm">
        <span className="font-medium">
          {sameDay ? Fmt.pattern(start, "d 'de' MMM 'de' yyyy") : `${Fmt.pattern(start, "MMM 'de' yyyy")} – ${Fmt.pattern(end, "MMM 'de' yyyy")}`}
        </span>
        <span className="text-ink-3"> · {Fmt.plural(s.spanDays, 'dia', 'dias')}</span>
      </span>
      <span className="code text-xs text-ink-3">
        {Fmt.plural(s.distinctEpisodes, 'episódio', 'episódios')} · {Duration.ofSeconds(s.totalSeconds).toShort()}
      </span>
    </li>
  )
}

/** Régua de tempo com um segmento por vez. SVG simples: poucos elementos, largura fluida. */
function Strip({ sessions, now }: { sessions: RewatchSession[]; now: Date }) {
  const first = parseISO(sessions[0]!.startedAt).getTime()
  const last = Math.max(now.getTime(), parseISO(sessions[sessions.length - 1]!.endedAt).getTime())
  const span = Math.max(1, last - first)
  const pos = (t: number) => ((t - first) / span) * 100

  const firstYear = new Date(first).getFullYear()
  const lastYear = new Date(last).getFullYear()
  const step = Math.max(1, Math.ceil((lastYear - firstYear) / 6))
  const years: number[] = []
  for (let y = firstYear + 1; y <= lastYear; y += step) years.push(y)

  return (
    <div className="relative h-12" aria-hidden>
      <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-surface-2" />
      {sessions.map((s) => {
        const left = pos(parseISO(s.startedAt).getTime())
        const width = Math.max(0.8, pos(parseISO(s.endedAt).getTime()) - left)
        return (
          <div
            key={s.ordinal}
            title={`${s.ordinal}ª vez`}
            className="absolute top-2 h-4 rounded-full bg-accent ring-2 ring-surface"
            style={{ left: `${left}%`, width: `${width}%`, minWidth: 6 }}
          />
        )
      })}
      {years.map((y) => (
        <span key={y} className="code absolute top-8 -translate-x-1/2 text-[10px] text-ink-3" style={{ left: `${pos(new Date(y, 0, 1).getTime())}%` }}>
          {y}
        </span>
      ))}
    </div>
  )
}
