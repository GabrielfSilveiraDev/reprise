import { Link } from '@tanstack/react-router'
import { ArrowRight, LibraryBig, Plus } from 'lucide-react'
import { useState } from 'react'
import type { ShelfItem } from '@/domain/NextUpShelf'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/ui/Feedback'
import { SectionTitle } from '@/ui/PageHeader'
import { CompactShelfRow, NextUpCard } from './NextUpCard'
import { PremiereRail } from './PremiereRail'
import { SOON_DAYS, type HomeModel } from './useHomeModel'

/**
 * "Agora", na Brasa: cartões da fila em grade, estreias numa faixa e o resto recolhido. É a tela
 * de todo dia, então a primeira coisa nela é o botão que se aperta todo dia — "Assisti".
 */
export function HomeBrasa({ model }: { model: HomeModel }) {
  const { now, clock, greeting, firstName, nextUp, shelf, soon, summary } = model

  return (
    <div className="space-y-14">
      <header className="animate-rise">
        <p className="eyebrow">{Fmt.pattern(now, "EEEE, d 'de' MMMM")}</p>
        <h1 className="headline mt-2 text-[2.6rem] leading-none sm:text-6xl">
          {greeting}, {firstName}.
        </h1>
        {summary && <p className="mt-3 text-ink-2">{summary}</p>}
      </header>

      <section aria-labelledby="continuar">
        <SectionTitle id="continuar" title="Continuar" hint="O próximo episódio de cada série que você viu no último mês — inclusive as que está revendo" />
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
          <NothingRunning empty={shelf?.isEmpty ?? true} />
        )}
      </section>

      {soon.length > 0 && (
        <section aria-labelledby="saindo">
          <SectionTitle
            id="saindo"
            title="Saindo em breve"
            hint={`Estreias dos próximos ${SOON_DAYS} dias, no seu fuso`}
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

/** A fila de hoje vazia: ou está tudo em dia, ou o que há está parado — e cada caso diz o quê. */
export function NothingRunning({ empty }: { empty: boolean }) {
  return (
    <EmptyState
      icon={<LibraryBig />}
      title={empty ? 'Tudo em dia' : 'Nada em andamento'}
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
      {empty
        ? 'Não há episódio lançado esperando por você em nenhuma série que você acompanha.'
        : 'Nenhuma série foi assistida no último mês. As que você deixou no meio estão logo abaixo.'}
    </EmptyState>
  )
}

function CollapsibleShelf({ id, title, hint, entries }: { id: string; title: string; hint: string; entries: ShelfItem[] }) {
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
