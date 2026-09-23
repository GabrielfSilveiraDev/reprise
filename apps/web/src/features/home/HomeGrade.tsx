import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { ShelfItem } from '@/domain/NextUpShelf'
import type { AgendaEntry } from '@/domain/PremiereAgenda'
import type { ReleaseClock } from '@/domain/ReleaseClock'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Controls'
import { ErrorState, Skeleton } from '@/ui/Feedback'
import { Poster } from '@/ui/Poster'
import { NothingRunning } from './HomeBrasa'
import { DismissRewatchButton, RewatchBadge } from './RewatchBits'
import { ShelfText, useShelfItem } from './useShelfItem'
import { SOON_DAYS, type HomeModel } from './useHomeModel'

/**
 * "Agora", na Grade: a página de programação do jornal. Cada bloco é numerado, a fila é uma
 * tabela com o que assistir em cada linha, e as estreias são uma grade de horários. Nada de
 * cartão: fios separam, a tipografia hierarquiza.
 */
export function HomeGrade({ model }: { model: HomeModel }) {
  const { now, clock, greeting, firstName, nextUp, shelf, soon } = model
  const numbers = new SectionNumbers()

  return (
    <div className="space-y-14">
      <header className="grid gap-6 border-b-2 border-line-strong pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="animate-rise">
          <p className="eyebrow">{Fmt.pattern(now, "EEEE · dd.MM.yyyy")}</p>
          <h1 className="headline mt-3 text-5xl sm:text-7xl">
            {greeting}, {firstName}.
          </h1>
        </div>
        {shelf && !shelf.isEmpty && (
          <dl className="grid grid-cols-3 border border-line-strong">
            <Figure label="Em andamento" value={shelf.active.length - shelf.rewatching} />
            <Figure label="Esperando" value={shelf.waiting} />
            <Figure label={`Estreias ${SOON_DAYS}d`} value={soon.length} />
          </dl>
        )}
      </header>

      <Block n={numbers.next()} id="continuar" title="Continuar" hint="Vistas no último mês, inclusive revisões">
        {nextUp.isPending ? (
          <div className="border-t border-line-strong">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="my-3 h-14 rounded-none" />
            ))}
          </div>
        ) : nextUp.isError ? (
          <ErrorState error={nextUp.error} onRetry={() => void nextUp.refetch()} />
        ) : shelf && shelf.active.length > 0 ? (
          <ol className="border-t-2 border-line-strong">
            {shelf.active.map((entry, i) => (
              <ListingRow key={entry.item.seriesId} entry={entry} index={i} />
            ))}
          </ol>
        ) : (
          <NothingRunning empty={shelf?.isEmpty ?? true} />
        )}
      </Block>

      {soon.length > 0 && (
        <Block
          n={numbers.next()}
          id="no-ar"
          title="No ar em breve"
          hint={`Próximos ${SOON_DAYS} dias, no seu fuso`}
          action={
            <Link to="/agenda" className="code inline-flex items-center gap-1 text-xs font-medium tracking-wide text-accent-ink uppercase hover:underline">
              Agenda <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <Timetable entries={soon} clock={clock} />
        </Block>
      )}

      {shelf && shelf.notStarted.length > 0 && (
        <Block n={numbers.next()} id="para-comecar" title="Para começar" hint="Acompanhadas, nenhum episódio visto">
          <CompactList entries={shelf.notStarted} />
        </Block>
      )}
      {shelf && shelf.paused.length > 0 && (
        <Block n={numbers.next()} id="parou" title="Parou no meio" hint="Sem exibição há mais de um mês">
          <CompactList entries={shelf.paused} />
        </Block>
      )}
    </div>
  )
}

/** "01", "02"… na ordem em que os blocos aparecem — um bloco que some não deixa buraco na numeração. */
class SectionNumbers {
  private n = 0
  next(): string {
    this.n += 1
    return String(this.n).padStart(2, '0')
  }
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-line-strong px-4 py-3 last:border-r-0 sm:px-6">
      <dt className="eyebrow whitespace-nowrap">{label}</dt>
      <dd className="code mt-1 text-3xl font-semibold sm:text-4xl">{Fmt.number(value)}</dd>
    </div>
  )
}

function Block({ n, id, title, hint, action, children }: { n: string; id: string; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="code text-sm font-semibold text-accent-ink" aria-hidden>
          {n}
        </span>
        <h2 id={id} className="headline text-3xl">
          {title}
        </h2>
        {hint && <p className="text-sm text-ink-3">{hint}</p>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Uma linha da programação: número, pôster pequeno, série, próximo episódio e o botão. */
function ListingRow({ entry, index }: { entry: ShelfItem; index: number }) {
  const s = useShelfItem(entry)
  const { item } = s

  return (
    <li className="grid animate-rise grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-line-strong py-3 transition-colors hover:bg-surface sm:grid-cols-[2rem_2.75rem_minmax(0,1.2fr)_minmax(0,1fr)_9rem]">
      <span className="code hidden text-sm text-ink-3 sm:block">{String(index + 1).padStart(2, '0')}</span>
      <Link {...s.series} tabIndex={-1} aria-hidden>
        <Poster path={item.posterPath} name={item.seriesName} size="w92" sizes="44px" className="w-11" />
      </Link>
      <div className="min-w-0">
        <Link {...s.series} className="block truncate text-lg font-semibold tracking-tight hover:text-accent-ink">
          {item.seriesName}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
          {s.rewatch && <RewatchBadge />}
          <span className="truncate">{s.rewatch ? ShelfText.idle(entry.daysIdle) : s.line}</span>
        </p>
        <p className="mt-1 truncate text-sm sm:hidden">
          <span className="code font-semibold text-accent-ink">{s.code.toString()}</span> <span className="text-ink-2">{item.episode.name}</span>
        </p>
      </div>
      <Link {...s.episode} className="hidden min-w-0 sm:block">
        <span className="code block text-sm font-semibold text-accent-ink">{s.code.toString()}</span>
        <span className="block truncate text-sm text-ink-2 hover:underline">{item.episode.name ?? 'Sem título'}</span>
      </Link>
      <div className="flex items-center justify-end gap-1">
        {s.rewatch && <DismissRewatchButton label={s.dismissLabel} onClick={s.dismiss} />}
        <Button
          variant={s.done ? 'secondary' : 'primary'}
          size="sm"
          loading={s.pending}
          disabled={s.done}
          icon={<Check className="size-4" />}
          onClick={s.mark}
          aria-label={s.markLabel}
        >
          <span className="hidden sm:inline">{s.done ? 'Visto' : 'Assisti'}</span>
        </Button>
      </div>
    </li>
  )
}

/** Estreias como grade de horários: o dia só aparece na primeira linha dele. */
function Timetable({ entries, clock }: { entries: AgendaEntry[]; clock: ReleaseClock }) {
  const days = entries.map((e) => clock.dayLabel(e.instant))
  return (
    <ol className="border-t-2 border-line-strong">
      {entries.map(({ premiere, instant }, i) => {
        const day = days[i]!
        const firstOfDay = i === 0 || day !== days[i - 1]
        return (
          <li
            key={premiere.episodeId}
            className={`grid grid-cols-[5.5rem_3.5rem_minmax(0,1fr)] items-baseline gap-x-3 py-2.5 sm:grid-cols-[8rem_4rem_minmax(0,1fr)_auto] ${firstOfDay ? 'border-t border-line-strong first:border-t-0' : 'border-t border-line'}`}
          >
            <span className="code truncate text-xs font-semibold tracking-wide text-ink-3 uppercase">{firstOfDay ? day : ''}</span>
            <span className="code text-sm font-semibold">{Fmt.time(instant)}</span>
            <Link
              to="/serie/$seriesId"
              params={{ seriesId: premiere.seriesId }}
              search={{ ep: premiere.episodeId }}
              className="truncate font-medium hover:text-accent-ink"
            >
              {premiere.seriesName}
            </Link>
            <span className="col-start-3 flex items-center gap-2 text-xs text-ink-3 sm:col-start-auto">
              <span className="code">{EpisodeCode.of(premiere).toString()}</span>
              {premiere.isSeasonPremiere && <Badge tone="accent">estreia</Badge>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function CompactList({ entries }: { entries: ShelfItem[] }) {
  const [all, setAll] = useState(false)
  const LIMIT = 9
  const visible = all ? entries : entries.slice(0, LIMIT)
  return (
    <>
      <ul className="grid border-t-2 border-line-strong sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
        {visible.map((entry) => (
          <CompactRow key={entry.item.seriesId} entry={entry} />
        ))}
      </ul>
      {entries.length > LIMIT && (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setAll((v) => !v)}>
          {all ? 'Menos' : `Todas (${entries.length})`}
        </Button>
      )}
    </>
  )
}

function CompactRow({ entry }: { entry: ShelfItem }) {
  const s = useShelfItem(entry)
  return (
    <li className="flex items-center gap-3 border-b border-line py-2">
      <Link {...s.series} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{s.item.seriesName}</span>
        <span className="block truncate text-xs text-ink-3">
          <span className="code">{s.code.toString()}</span> · {ShelfText.idle(entry.daysIdle)}
        </span>
      </Link>
      <Button variant="ghost" size="icon-sm" loading={s.pending} onClick={s.mark} aria-label={s.markLabel} icon={s.pending ? undefined : <Check className="size-4" />} />
    </li>
  )
}
