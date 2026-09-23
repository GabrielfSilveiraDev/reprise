import { Check } from 'lucide-react'
import { useState } from 'react'
import { useEpisodeActions } from '@/api/mutations'
import type { Episode, SeriesDetail } from '@/api/types'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { SeriesProgress } from '@/domain/SeriesProgress'
import { TmdbImage } from '@/domain/TmdbImage'
import { ProductionStatusInfo } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Poster } from '@/ui/Poster'
import { ProgressBar } from '@/ui/ProgressBar'
import { StatusMenu } from './StatusMenu'

/**
 * A capa da série. O fundo é o próprio pôster, desfocado — cada série pinta a página com as
 * cores dela, sem precisar de uma imagem a mais do TMDB.
 */
export function SeriesHero({ series, nextUp, onOpenEpisode }: { series: SeriesDetail; nextUp: Episode | null; onOpenEpisode: (id: number) => void }) {
  const progress = new SeriesProgress(series)
  const { mark } = useEpisodeActions()
  const [expanded, setExpanded] = useState(false)
  const backdrop = TmdbImage.url(series.posterPath, 'w342')
  const year = series.firstAirDate?.slice(0, 4)
  const meta = [year, ProductionStatusInfo.label(series.productionStatus), Fmt.plural(series.episodesTotal, 'episódio', 'episódios')].filter(Boolean)
  const tracked = series.status !== 'Untracked'

  return (
    <section className="relative -mx-4 -mt-6 mb-12 overflow-hidden sm:-mx-6 lg:-mx-10 lg:-mt-10">
      <div aria-hidden className="absolute inset-0">
        {backdrop && <img src={backdrop} alt="" className="size-full scale-125 object-cover opacity-50 blur-3xl saturate-150" />}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-bg/75 to-bg" />
      </div>

      <div className="relative flex flex-col gap-6 px-4 pt-8 sm:flex-row sm:items-end sm:px-6 lg:gap-10 lg:px-10 lg:pt-14">
        <Poster path={series.posterPath} name={series.name} size="w342" sizes="(min-width: 1024px) 224px, 160px" eager className="w-40 shadow-pop lg:w-56" />

        <div className="min-w-0 flex-1 pb-1">
          <p className="eyebrow">{meta.join(' · ')}</p>
          <h1 className="headline mt-2 text-[2.75rem] leading-[0.95] text-balance sm:text-6xl lg:text-7xl">{series.name}</h1>
          {series.originalName && series.originalName !== series.name && <p className="mt-2 text-ink-3 italic">{series.originalName}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <StatusMenu seriesId={series.id} status={series.status} />
            {tracked && nextUp && (
              <>
                <Button
                  variant="primary"
                  loading={mark.isPending}
                  icon={<Check className="size-4" />}
                  onClick={() => mark.mutate({ seriesId: series.id, seriesName: series.name, episode: nextUp })}
                >
                  Assisti <span className="code font-semibold">{EpisodeCode.of(nextUp).toString()}</span>
                </Button>
                <Button variant="ghost" onClick={() => onOpenEpisode(nextUp.id)} className="hidden sm:inline-flex">
                  {nextUp.name ?? 'Próximo episódio'}
                </Button>
              </>
            )}
          </div>

          <div className="mt-6 max-w-xl">
            <ProgressBar numbers={series} />
            <p className="mt-2 text-sm text-ink-2">
              <span className="font-semibold text-ink">{Fmt.number(progress.watched)}</span> de {Fmt.number(progress.total)} vistos
              <span className="text-ink-3"> · {progress.summary}</span>
            </p>
          </div>
        </div>
      </div>

      {series.overview && (
        <div className="relative mt-8 max-w-3xl px-4 sm:px-6 lg:px-10">
          <p className={expanded ? 'text-ink-2' : 'line-clamp-3 text-ink-2'}>{series.overview}</p>
          {series.overview.length > 240 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-accent-ink hover:underline">
              {expanded ? 'Menos' : 'Mais'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
