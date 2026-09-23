import { Link } from '@tanstack/react-router'
import type { SeriesListItem } from '@/api/types'
import { SeriesProgress } from '@/domain/SeriesProgress'
import { Fmt } from '@/lib/format'
import { Skeleton } from '@/ui/Feedback'
import { Poster } from '@/ui/Poster'

/**
 * O acervo da Sessão: uma parede de cartazes. O pôster é o protagonista; o nome vem embaixo, em
 * serifa, e o progresso é um fio dourado na base do cartaz — lido de relance, sem disputar com a
 * arte.
 */
export function CollectionSessao({ series }: { series: SeriesListItem[] | null }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-9 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {series === null
        ? Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] rounded-poster" />
              <Skeleton className="mt-3 h-5 w-3/4" />
            </div>
          ))
        : series.map((s, i) => <Marquee key={s.id} series={s} index={i} />)}
    </div>
  )
}

function Marquee({ series, index }: { series: SeriesListItem; index: number }) {
  const progress = new SeriesProgress(series)
  const watched = progress.total ? (progress.watched / progress.total) * 100 : 0

  return (
    <Link
      to="/serie/$seriesId"
      params={{ seriesId: series.id }}
      className="group block animate-rise"
      style={{ animationDelay: `${Math.min(index, 18) * 18}ms` }}
    >
      <div className="relative overflow-hidden rounded-poster transition duration-300 group-hover:-translate-y-1 group-hover:shadow-pop">
        <Poster path={series.posterPath} name={series.name} size="w342" sizes="(min-width: 1024px) 200px, 45vw" className="rounded-none" />
        {progress.phase === 'behind' && (
          <span className="absolute top-2 right-2 rounded-pill bg-bg/80 px-2 py-0.5 text-[11px] font-semibold text-accent-ink backdrop-blur">
            {progress.backlog > 99 ? '99+' : progress.backlog} por ver
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/35" aria-hidden>
          <div className="h-full bg-accent" style={{ width: `${watched}%` }} />
        </div>
      </div>
      <p className="headline mt-3 line-clamp-2 text-xl leading-tight group-hover:text-accent-ink">{series.name}</p>
      <p className="mt-1 text-xs text-ink-3">
        <span className="code">
          {Fmt.number(progress.watched)}/{Fmt.number(progress.total)}
        </span>{' '}
        · {progress.summary}
      </p>
    </Link>
  )
}
