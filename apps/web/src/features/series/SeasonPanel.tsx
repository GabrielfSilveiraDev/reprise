import { clsx } from 'clsx'
import { parseISO } from 'date-fns'
import { ListChecks } from 'lucide-react'
import { Tabs } from 'radix-ui'
import type { SeriesDetail } from '@/api/types'
import { Duration } from '@/domain/Duration'
import type { EpisodeMap, MapCell, MapRow } from '@/domain/EpisodeMap'
import type { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Controls'
import { EpisodeMenu, type EpisodeHandlers, WatchControl } from './EpisodeControls'

export function SeasonPanel({
  series,
  map,
  clock,
  active,
  onSelect,
  onMarkSeason,
  handlers,
}: {
  series: SeriesDetail
  map: EpisodeMap
  clock: ReleaseClock
  active: number | null
  onSelect: (season: number) => void
  onMarkSeason: (row: MapRow) => void
  handlers: EpisodeHandlers
}) {
  if (active === null) return null

  return (
    <Tabs.Root value={String(active)} onValueChange={(v) => onSelect(Number(v))}>
      <Tabs.List aria-label="Temporadas" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {map.rows.map((row) => (
          <Tabs.Trigger
            key={row.season.seasonNumber}
            value={String(row.season.seasonNumber)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-bg"
          >
            {row.season.isSpecials ? 'Especiais' : `Temporada ${row.season.seasonNumber}`}
            <span className={clsx('code text-[11px] opacity-70', row.watched === row.total && row.total > 0 && 'text-ok opacity-100')}>
              {row.watched}/{row.total}
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {map.rows.map((row) => (
        <Tabs.Content key={row.season.seasonNumber} value={String(row.season.seasonNumber)} className="mt-4 outline-none">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
              <div>
                <h3 className="headline text-2xl">{row.season.isSpecials ? 'Especiais' : `Temporada ${row.season.seasonNumber}`}</h3>
                <p className="text-sm text-ink-3">
                  {row.watched} de {row.total} vistos
                  {row.total > row.released && ` · ${row.total - row.released} a lançar`}
                  {row.season.isSpecials && ' · fora do progresso'}
                </p>
              </div>
              {!row.season.isSpecials && (
                <Button variant="outline" size="sm" icon={<ListChecks className="size-4" />} disabled={row.pending === 0} onClick={() => onMarkSeason(row)}>
                  {row.pending === 0 ? 'Temporada em dia' : `Marcar temporada (${row.pending})`}
                </Button>
              )}
            </header>
            <ol>
              {row.cells.map((cell) => (
                <EpisodeRow key={cell.episode.id} series={series} cell={cell} clock={clock} pendingUpTo={map.pendingUpTo(cell.episode)} handlers={handlers} />
              ))}
            </ol>
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}

function EpisodeRow({
  series,
  cell,
  clock,
  pendingUpTo,
  handlers,
}: {
  series: SeriesDetail
  cell: MapCell
  clock: ReleaseClock
  pendingUpTo: number
  handlers: EpisodeHandlers
}) {
  const e = cell.episode
  const released = cell.state !== 'upcoming'
  const details = [
    clock.label(e),
    e.runtimeSeconds ? Duration.ofSeconds(e.runtimeSeconds).toShort() : null,
    e.lastWatchedAt ? `visto ${Fmt.ago(parseISO(e.lastWatchedAt), clock.now)}` : null,
  ].filter(Boolean)

  return (
    <li
      id={`ep-${e.id}`}
      className={clsx(
        'flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4',
        cell.isNext && 'bg-accent-soft/50',
        !released && 'text-ink-3',
      )}
    >
      <WatchControl series={series} episode={e} released={released} releaseLabel={clock.label(e)} handlers={handlers} />
      <button type="button" onClick={() => handlers.onOpen(e.id)} className="min-w-0 flex-1 text-left">
        <span className="flex items-baseline gap-2">
          <span className="code shrink-0 text-xs text-ink-3">{cell.code.toString()}</span>
          <span className="truncate text-[15px] font-medium hover:underline">{e.name ?? 'Sem título'}</span>
          {cell.isNext && <Badge tone="accent">próximo</Badge>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-3">{details.join(' · ')}</span>
      </button>
      {e.watchCount > 1 && (
        <Badge tone="accent" className="code">
          {e.watchCount}×
        </Badge>
      )}
      <EpisodeMenu episode={e} released={released} pendingUpTo={pendingUpTo} handlers={handlers} />
    </li>
  )
}
