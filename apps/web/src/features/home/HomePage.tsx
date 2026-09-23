import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, LibraryBig, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Queries } from '@/api/queries'
import { useSession } from '@/app/useSession'
import { NextUpShelf } from '@/domain/NextUpShelf'
import { PremiereAgenda } from '@/domain/PremiereAgenda'
import { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/ui/Feedback'
import { SectionTitle } from '@/ui/PageHeader'
import { CompactShelfRow, NextUpCard } from './NextUpCard'
import { PremiereRail } from './PremiereRail'

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * "Agora": o que assistir em seguida e o que está para sair. É a tela de todo dia, então a
 * primeira coisa nela é o botão que se aperta todo dia — "Assisti".
 */
export function HomePage() {
  const session = useSession()
  const nextUp = useQuery(Queries.nextUp())
  const series = useQuery(Queries.seriesList())
  const premieres = useQuery(Queries.premieres())
  const [now] = useState(() => new Date())

  const shelf = useMemo(() => (nextUp.data ? new NextUpShelf(nextUp.data, series.data, now) : null), [nextUp.data, series.data, now])
  const clock = useMemo(() => new ReleaseClock(now), [now])
  const soon = useMemo(() => (premieres.data ? new PremiereAgenda(premieres.data, clock).within(8) : []), [premieres.data, clock])

  const firstName = session?.displayName.split(/\s+/)[0] ?? ''
  const waiting = shelf?.active.reduce((sum, s) => sum + (s.backlog ?? 1), 0) ?? 0

  return (
    <div className="space-y-14">
      <header className="animate-rise">
        <p className="eyebrow">{Fmt.pattern(now, "EEEE, d 'de' MMMM")}</p>
        <h1 className="headline mt-2 text-[2.6rem] leading-none sm:text-6xl">
          {greeting(now)}, {firstName}.
        </h1>
        {shelf && !shelf.isEmpty && (
          <p className="mt-3 text-ink-2">
            {shelf.active.length > 0
              ? `${Fmt.plural(shelf.active.length, 'série em andamento', 'séries em andamento')} · ${Fmt.plural(waiting, 'episódio esperando', 'episódios esperando')}.`
              : 'Nenhuma série em andamento no último mês.'}
            {soon.length > 0 && ` ${Fmt.plural(soon.length, 'estreia', 'estreias')} nos próximos dias.`}
          </p>
        )}
      </header>

      <section aria-labelledby="continuar">
        <SectionTitle id="continuar" title="Continuar" hint="O próximo episódio de cada série que você viu no último mês" />
        {nextUp.isPending ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[164px] rounded-card" />
            ))}
          </div>
        ) : nextUp.isError ? (
          <ErrorState error={nextUp.error} onRetry={() => void nextUp.refetch()} />
        ) : shelf && shelf.active.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shelf.active.map((entry, i) => (
              <NextUpCard key={entry.item.seriesId} entry={entry} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<LibraryBig />}
            title={shelf?.isEmpty ? 'Tudo em dia' : 'Nada em andamento'}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="primary" icon={<Plus className="size-4" />}>
                  <Link to="/buscar">Adicionar série</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/acervo">Abrir acervo</Link>
                </Button>
              </div>
            }
          >
            {shelf?.isEmpty
              ? 'Não há episódio lançado esperando por você em nenhuma série que você acompanha.'
              : 'Nenhuma série foi assistida no último mês. As que você deixou no meio estão logo abaixo.'}
          </EmptyState>
        )}
      </section>

      {soon.length > 0 && (
        <section aria-labelledby="saindo">
          <SectionTitle
            id="saindo"
            title="Saindo em breve"
            hint="Estreias dos próximos 8 dias, no seu fuso"
            action={
              <Link to="/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                Agenda <ArrowRight className="size-4" />
              </Link>
            }
          />
          <PremiereRail entries={soon} clock={clock} />
        </section>
      )}

      {shelf && shelf.notStarted.length > 0 && (
        <CollapsibleShelf id="comecar" title="Para começar" hint="Séries que você acompanha e ainda não começou" entries={shelf.notStarted} />
      )}
      {shelf && shelf.paused.length > 0 && (
        <CollapsibleShelf id="parou" title="Parou no meio" hint="Começou, mas não assiste há mais de um mês" entries={shelf.paused} />
      )}
    </div>
  )
}

function CollapsibleShelf({ id, title, hint, entries }: { id: string; title: string; hint: string; entries: NextUpShelf['paused'] }) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 6
  const visible = expanded ? entries : entries.slice(0, LIMIT)
  return (
    <section aria-labelledby={id}>
      <SectionTitle id={id} title={title} hint={hint} />
      <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((entry) => (
          <CompactShelfRow key={entry.item.seriesId} entry={entry} />
        ))}
      </div>
      {entries.length > LIMIT && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Mostrar menos' : `Mostrar todas (${entries.length})`}
        </Button>
      )}
    </section>
  )
}
