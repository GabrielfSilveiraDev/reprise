import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import type { SeriesListItem } from '@/api/types'
import { SeriesProgress } from '@/domain/SeriesProgress'
import { Fmt } from '@/lib/format'
import { Poster } from '@/ui/Poster'
import { ProgressBar } from '@/ui/ProgressBar'

/** Pôster, progresso em três partes e uma frase: é o que se lê numa grade de cem séries. */
export function SeriesCard({ series, index }: { series: SeriesListItem; index: number }) {
  const progress = new SeriesProgress(series)
  const phase = progress.phase

  return (
    <Link
      to="/serie/$seriesId"
      params={{ seriesId: series.id }}
      className="group block animate-rise"
      style={{ animationDelay: `${Math.min(index, 18) * 18}ms` }}
    >
      <div className="relative">
        <Poster
          path={series.posterPath}
          name={series.name}
          size="w342"
          sizes="(min-width: 1024px) 180px, 45vw"
          className="transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-pop"
        />
        {phase === 'behind' && (
          <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg shadow-sm">
            {progress.backlog > 99 ? '99+' : progress.backlog}
          </span>
        )}
        {phase === 'complete' && (
          <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-ink text-bg shadow-sm" title="Completa">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm leading-snug font-semibold group-hover:text-accent-ink">{series.name}</p>
      <div className="mt-1.5">
        <ProgressBar numbers={series} thin />
      </div>
      <p className="mt-1.5 flex justify-between gap-2 text-xs text-ink-3">
        <span className="code">
          {Fmt.number(progress.watched)}/{Fmt.number(progress.total)}
        </span>
        <span className="truncate">{progress.summary}</span>
      </p>
    </Link>
  )
}
