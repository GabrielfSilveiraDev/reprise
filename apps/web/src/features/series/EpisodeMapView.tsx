import { clsx } from 'clsx'
import { parseISO } from 'date-fns'
import { useRef, useState } from 'react'
import type { EpisodeMap, MapCell } from '@/domain/EpisodeMap'
import type { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'

export const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const

function describeCell(cell: MapCell, clock: ReleaseClock): string {
  const e = cell.episode
  if (cell.state === 'upcoming') return clock.label(e)
  if (cell.state === 'unwatched') return cell.isNext ? 'próximo a assistir' : 'não visto'
  const last = e.lastWatchedAt ? ` · última vez ${Fmt.day(parseISO(e.lastWatchedAt))}` : ''
  return `visto ${e.watchCount}×${last}`
}

/**
 * A série numa grade: uma linha por temporada, um quadrado por episódio, a cor pela contagem de
 * exibições. Rever deixa o quadrado mais quente. O contorno tracejado é o que ainda não saiu, e o
 * anel marca o próximo a assistir.
 *
 * Um tooltip só, reposicionado a cada foco — em série longa são centenas de células, e um
 * componente de tooltip por célula custaria centenas de instâncias para mostrar uma de cada vez.
 */
export function EpisodeMapView({
  map,
  clock,
  activeSeason,
  onSelectSeason,
  onOpenEpisode,
}: {
  map: EpisodeMap
  clock: ReleaseClock
  activeSeason: number | null
  onSelectSeason: (season: number) => void
  onOpenEpisode: (episodeId: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ cell: MapCell; x: number; y: number } | null>(null)

  const show = (cell: MapCell, target: HTMLElement) => {
    const container = box.current
    if (!container) return
    const outer = container.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    const x = Math.min(Math.max(rect.left - outer.left + rect.width / 2, 110), outer.width - 110)
    setTip({ cell, x, y: rect.top - outer.top })
  }

  return (
    <div ref={box} className="relative" onMouseLeave={() => setTip(null)}>
      <div className="flex flex-col gap-2">
        {map.rows.map((row) => (
          <div key={row.season.seasonNumber} className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onSelectSeason(row.season.seasonNumber)}
              className={clsx(
                'code mt-px w-9 shrink-0 rounded-md py-0.5 text-left text-xs transition-colors',
                activeSeason === row.season.seasonNumber ? 'font-semibold text-accent-ink' : 'text-ink-3 hover:text-ink',
              )}
              aria-label={`Abrir ${row.season.isSpecials ? 'especiais' : `temporada ${row.season.seasonNumber}`}`}
            >
              {row.label}
            </button>
            <div className="flex flex-1 flex-wrap gap-[5px]">
              {row.cells.map((cell) => (
                <button
                  key={cell.episode.id}
                  type="button"
                  onClick={() => onOpenEpisode(cell.episode.id)}
                  onMouseEnter={(e) => show(cell, e.currentTarget)}
                  onFocus={(e) => show(cell, e.currentTarget)}
                  onBlur={() => setTip(null)}
                  aria-label={`${cell.code.toSpoken()}${cell.episode.name ? `, ${cell.episode.name}` : ''}: ${describeCell(cell, clock)}`}
                  className={clsx(
                    'size-[18px] rounded-[5px] transition-transform duration-150 hover:scale-125 focus-visible:scale-125 sm:size-5',
                    cell.state === 'upcoming' ? 'border border-dashed border-line-strong' : HEAT_BG[cell.level],
                    cell.isNext && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                  )}
                />
              ))}
            </div>
            <span className="code mt-px shrink-0 text-xs text-ink-3 tabular-nums">
              {row.watched}/{row.total}
            </span>
          </div>
        ))}
      </div>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-pop"
          style={{ left: tip.x, top: tip.y - 8 }}
        >
          <span className="code font-semibold">{tip.cell.code.toString()}</span>
          {tip.cell.episode.name && <span className="ml-1.5">{tip.cell.episode.name}</span>}
          <span className="mt-0.5 block opacity-70">{describeCell(tip.cell, clock)}</span>
        </div>
      )}
    </div>
  )
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-3" aria-label="Legenda do mapa">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] bg-heat-0" /> não visto
      </span>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className={clsx('size-3 rounded-[3px]', HEAT_BG[n])} /> {n === 4 ? '4+' : `${n}×`}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-dashed border-line-strong" /> a lançar
      </span>
    </div>
  )
}
