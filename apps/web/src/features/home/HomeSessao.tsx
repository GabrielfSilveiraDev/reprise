import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { ShelfItem } from '@/domain/NextUpShelf'
import type { AgendaEntry } from '@/domain/PremiereAgenda'
import type { ReleaseClock } from '@/domain/ReleaseClock'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { TmdbImage } from '@/domain/TmdbImage'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { ErrorState, Skeleton } from '@/ui/Feedback'
import { Poster } from '@/ui/Poster'
import { NothingRunning } from './HomeBrasa'
import { DismissRewatchButton, RewatchBadge } from './RewatchBits'
import { ShelfText, useShelfItem } from './useShelfItem'
import type { HomeModel } from './useHomeModel'

/**
 * "Agora", na Sessão. Uma sala de cinema tem uma tela: a série que você viu por último ocupa o
 * palco, com o próprio pôster desfocado como luz de fundo, e o resto da fila vem depois, como os
 * cartazes do saguão — em faixas de pôsteres que rolam de lado.
 */
export function HomeSessao({ model }: { model: HomeModel }) {
  const { now, clock, greeting, firstName, nextUp, shelf, soon, summary } = model
  const [feature, ...queue] = shelf?.active ?? []

  return (
    <div className="space-y-16">
      <header className="animate-rise">
        <p className="eyebrow">{Fmt.pattern(now, "EEEE, d 'de' MMMM")}</p>
        <h1 className="headline mt-3 text-4xl italic sm:text-5xl">
          {greeting}, {firstName}.
        </h1>
        {summary && <p className="mt-2 max-w-2xl text-ink-2">{summary}</p>}
      </header>

      {nextUp.isPending ? (
        <Skeleton className="h-[380px] rounded-card" />
      ) : nextUp.isError ? (
        <ErrorState error={nextUp.error} onRetry={() => void nextUp.refetch()} />
      ) : feature ? (
        <Feature entry={feature} />
      ) : (
        <NothingRunning empty={shelf?.isEmpty ?? true} />
      )}

      {queue.length > 0 && (
        <Rail id="na-fila" title="Na fila" hint="Também em andamento neste mês">
          {queue.map((entry) => (
            <QueueTile key={entry.item.seriesId} entry={entry} />
          ))}
        </Rail>
      )}

      {soon.length > 0 && (
        <Rail
          id="em-breve"
          title="Em breve"
          hint="Estreias da semana, no seu fuso"
          action={
            <Link to="/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
              Agenda completa <ArrowRight className="size-4" />
            </Link>
          }
        >
          {soon.map((entry) => (
            <PremiereTile key={entry.premiere.episodeId} entry={entry} clock={clock} />
          ))}
        </Rail>
      )}

      {shelf && shelf.notStarted.length > 0 && (
        <Rail id="para-comecar" title="Para começar" hint="Na sua lista, ainda sem nenhum episódio visto">
          <Limited entries={shelf.notStarted} render={(entry) => <QueueTile key={entry.item.seriesId} entry={entry} small />} />
        </Rail>
      )}
      {shelf && shelf.paused.length > 0 && (
        <Rail id="parou" title="Parou no meio" hint="Começou, mas não assiste há mais de um mês">
          <Limited entries={shelf.paused} render={(entry) => <QueueTile key={entry.item.seriesId} entry={entry} small />} />
        </Rail>
      )}
    </div>
  )
}

/** O palco: a série mais recente da fila, grande, com o botão de hoje. */
function Feature({ entry }: { entry: ShelfItem }) {
  const s = useShelfItem(entry)
  const { item } = s
  const backdrop = TmdbImage.url(item.posterPath, 'w342')

  return (
    <section aria-labelledby="em-cartaz" className="relative isolate animate-rise overflow-hidden rounded-card border border-line bg-surface">
      <div aria-hidden className="absolute inset-0 -z-10">
        {backdrop && <img src={backdrop} alt="" className="size-full scale-125 object-cover opacity-55 blur-3xl saturate-150" />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/85 to-surface/30 sm:bg-gradient-to-r" />
      </div>

      <div className="grid items-end gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10 sm:p-10">
        <Link {...s.series} tabIndex={-1} aria-hidden className="w-28 sm:w-44 lg:w-56">
          <Poster path={item.posterPath} name={item.seriesName} size="w342" sizes="(min-width: 1024px) 224px, 176px" eager className="shadow-pop" />
        </Link>

        <div className="min-w-0">
          <p className="eyebrow flex flex-wrap items-center gap-2">
            {s.rewatch ? <RewatchBadge /> : <span>Continuar</span>}
            <span aria-hidden>·</span>
            <span>{ShelfText.idle(entry.daysIdle)}</span>
          </p>
          <h2 id="em-cartaz" className="headline mt-4 text-5xl text-balance sm:text-6xl lg:text-7xl">
            <Link {...s.series} className="hover:text-accent-ink">
              {item.seriesName}
            </Link>
          </h2>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="code text-base font-semibold text-accent-ink">{s.code.toString()}</span>
            <span className="font-display text-2xl text-ink-2 italic">{item.episode.name ?? 'Sem título'}</span>
          </p>
          {!s.rewatch && entry.backlog !== null && entry.backlog > 1 && <p className="mt-1 text-sm text-ink-3">{ShelfText.standing(entry)}</p>}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              variant={s.done ? 'secondary' : 'primary'}
              size="lg"
              loading={s.pending}
              disabled={s.done}
              icon={<Check className={s.done ? 'size-5 animate-pop' : 'size-5'} />}
              onClick={s.mark}
              aria-label={s.markLabel}
              className="px-7"
            >
              {s.done ? 'Visto' : 'Assisti'}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link {...s.episode}>Sobre o episódio</Link>
            </Button>
            {s.rewatch && (
              <Button variant="ghost" size="lg" onClick={s.dismiss} aria-label={s.dismissLabel}>
                Tirar do Continuar
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Um cartaz da fila: o pôster é o botão da série; o "Assisti" fica sobre ele, ao alcance. */
function QueueTile({ entry, small = false }: { entry: ShelfItem; small?: boolean }) {
  const s = useShelfItem(entry)
  const { item } = s

  return (
    <li className={small ? 'w-[124px] shrink-0 snap-start' : 'w-[164px] shrink-0 snap-start sm:w-[184px]'}>
      <div className="group relative">
        <Link {...s.series} aria-label={item.seriesName} className="block">
          <Poster
            path={item.posterPath}
            name={item.seriesName}
            size={small ? 'w185' : 'w342'}
            sizes={small ? '124px' : '184px'}
            className="transition duration-300 group-hover:-translate-y-1 group-hover:shadow-pop"
          />
        </Link>
        {s.rewatch && <RewatchBadge className="absolute top-2 left-2 shadow-sm" />}
        {s.rewatch && (
          <DismissRewatchButton label={s.dismissLabel} onClick={s.dismiss} className="absolute top-1.5 right-1.5 bg-bg/75 text-ink backdrop-blur hover:bg-bg" />
        )}
        <Button
          variant={s.done ? 'secondary' : 'primary'}
          size={small ? 'icon-sm' : 'icon'}
          loading={s.pending}
          disabled={s.done}
          onClick={s.mark}
          aria-label={s.markLabel}
          icon={s.pending ? undefined : <Check className={s.done ? 'size-4 animate-pop' : 'size-4'} />}
          className="absolute right-2 bottom-2 shadow-pop"
        />
      </div>
      <Link {...s.series} className={`headline mt-3 line-clamp-2 block leading-tight hover:text-accent-ink ${small ? 'text-lg' : 'text-xl'}`}>
        {item.seriesName}
      </Link>
      <p className="mt-1 truncate text-sm text-ink-2">
        <span className="code font-semibold text-accent-ink">{s.code.toString()}</span> {!small && (item.episode.name ?? '')}
      </p>
      <p className="truncate text-xs text-ink-3">{small ? ShelfText.idle(entry.daysIdle) : s.rewatch ? ShelfText.idle(entry.daysIdle) : s.line}</p>
    </li>
  )
}

function PremiereTile({ entry, clock }: { entry: AgendaEntry; clock: ReleaseClock }) {
  const { premiere, instant } = entry
  return (
    <li className="w-[140px] shrink-0 snap-start">
      <Link to="/serie/$seriesId" params={{ seriesId: premiere.seriesId }} search={{ ep: premiere.episodeId }} className="group block">
        <Poster path={premiere.posterPath} name={premiere.seriesName} size="w185" sizes="140px" className="transition duration-300 group-hover:-translate-y-1" />
        <p className="mt-3 flex items-baseline gap-2">
          <span className="headline text-2xl first-letter:uppercase">{clock.dayLabel(instant)}</span>
          <span className="code text-sm text-accent-ink">{Fmt.time(instant)}</span>
        </p>
        <p className="truncate text-sm font-medium group-hover:text-accent-ink">{premiere.seriesName}</p>
        <p className="text-xs text-ink-3">
          <span className="code">{EpisodeCode.of(premiere).toString()}</span>
          {premiere.isSeasonPremiere && ' · estreia de temporada'}
        </p>
      </Link>
    </li>
  )
}

function Rail({ id, title, hint, action, children }: { id: string; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 id={id} className="headline text-3xl sm:text-4xl">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
        </div>
        {action}
      </div>
      <ul className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-5 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0">{children}</ul>
    </section>
  )
}

/** Faixas longas param num ponto e oferecem o resto — trinta pôsteres parados não são lembrete, são ruído. */
function Limited({ entries, render }: { entries: ShelfItem[]; render: (entry: ShelfItem) => ReactNode }) {
  const [all, setAll] = useState(false)
  const LIMIT = 10
  return (
    <>
      {(all ? entries : entries.slice(0, LIMIT)).map(render)}
      {entries.length > LIMIT && !all && (
        <li className="flex w-[124px] shrink-0 items-center">
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
            Mais {entries.length - LIMIT}
          </Button>
        </li>
      )}
    </>
  )
}
