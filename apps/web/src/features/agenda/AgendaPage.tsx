import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Queries } from '@/api/queries'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { type AgendaEntry, type AgendaSection, PremiereAgenda } from '@/domain/PremiereAgenda'
import { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'
import { Badge, Switch } from '@/ui/Controls'
import { EmptyState, ErrorState, Skeleton } from '@/ui/Feedback'
import { PageHeader } from '@/ui/PageHeader'
import { Poster } from '@/ui/Poster'

const route = getRouteApi('/_app/agenda')

/**
 * Tudo o que ainda vai sair nas séries em "Assistindo". Os horários são os de liberação no seu
 * fuso — exatos na TV aberta, uma estimativa conservadora no streaming (nunca antes da hora).
 */
export function AgendaPage() {
  const { estreias } = route.useSearch()
  const navigate = route.useNavigate()
  const onlySeasonPremieres = estreias ?? false
  const { data, isPending, isError, error, refetch } = useQuery(Queries.premieres())
  const [now] = useState(() => new Date())
  const clock = useMemo(() => new ReleaseClock(now), [now])
  const agenda = useMemo(() => (data ? new PremiereAgenda(data, clock) : null), [data, clock])
  const sections = agenda?.sections({ seasonPremieresOnly: onlySeasonPremieres }) ?? []
  const seriesCount = new Set(data?.map((p) => p.seriesId)).size

  return (
    <>
      <PageHeader
        eyebrow={data ? `${Fmt.plural(data.length, 'episódio', 'episódios')} · ${Fmt.plural(seriesCount, 'série', 'séries')}` : 'Agenda'}
        title="Agenda"
        subtitle="O que vem aí nas séries que você está assistindo, no seu horário."
        actions={
          <Switch
            checked={onlySeasonPremieres}
            onCheckedChange={(v) => void navigate({ search: { estreias: v || undefined } })}
            label="Só estreias de temporada"
          />
        }
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : sections.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="Nada agendado">
          {onlySeasonPremieres
            ? 'Nenhuma temporada nova anunciada nas séries que você está assistindo.'
            : 'Nenhum episódio com data nas séries em “Assistindo”. Séries arquivadas e concluídas não entram na agenda.'}
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <Section key={section.key} section={section} clock={clock} />
          ))}
        </div>
      )}
    </>
  )
}

function Section({ section, clock }: { section: AgendaSection; clock: ReleaseClock }) {
  const isToday = section.title === 'Hoje'
  return (
    <section aria-label={`${section.title}, ${section.subtitle}`} className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
      <header className="md:sticky md:top-6 md:self-start">
        <h2 className={clsx('headline text-3xl', isToday && 'text-accent-ink')}>{section.title}</h2>
        <p className="text-sm text-ink-3">{section.subtitle}</p>
      </header>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {section.entries.map((entry) => (
          <Row key={entry.premiere.episodeId} entry={entry} clock={clock} showDate={section.kind === 'month'} />
        ))}
      </ul>
    </section>
  )
}

function Row({ entry, clock, showDate }: { entry: AgendaEntry; clock: ReleaseClock; showDate: boolean }) {
  const p = entry.premiere
  const code = EpisodeCode.of(p)
  return (
    <li>
      <Link
        to="/serie/$seriesId"
        params={{ seriesId: p.seriesId }}
        search={{ ep: p.episodeId }}
        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <div className="w-14 shrink-0 text-right">
          <span className="code block text-sm font-semibold">{showDate ? Fmt.pattern(entry.instant, 'dd/MM') : Fmt.time(entry.instant)}</span>
          {showDate && <span className="block text-[11px] text-ink-3">{Fmt.pattern(entry.instant, 'EEE')}</span>}
        </div>
        <Poster path={p.posterPath} name={p.seriesName} size="w92" sizes="40px" className="w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.seriesName}</p>
          <p className="truncate text-sm text-ink-3">
            <span className="code">{code.toString()}</span>
            {p.episodeName && ` · ${p.episodeName}`}
          </p>
        </div>
        {p.isSeasonPremiere && <Badge tone="accent">estreia de temporada</Badge>}
        <span className="sr-only">{clock.label(p)}</span>
      </Link>
    </li>
  )
}
