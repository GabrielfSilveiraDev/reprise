import { Check } from 'lucide-react'
import { TmdbImage } from '@/domain/TmdbImage'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Poster } from '@/ui/Poster'
import { ProgressBar } from '@/ui/ProgressBar'
import { DismissRewatchButton, RewatchBadge } from '../home/RewatchBits'
import { Overview } from './HeroParts'
import type { HeroModel } from './SeriesHero'
import { StatusMenu } from './StatusMenu'

/**
 * A capa da série na Brasa. O fundo é o próprio pôster, desfocado — cada série pinta a página com
 * as cores dela, sem precisar de uma imagem a mais do TMDB.
 */
export function HeroBrasa({ model }: { model: HeroModel }) {
  const { series, progress, meta, tracked, next, nextCode } = model
  const backdrop = TmdbImage.url(series.posterPath, 'w342')

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
            {tracked && next && (
              <>
                <Button variant="primary" loading={model.marking} icon={<Check className="size-4" />} onClick={model.markNext}>
                  Assisti <span className="code font-semibold">{nextCode}</span>
                </Button>
                <Button variant="ghost" onClick={() => model.openEpisode(next.id)} className="hidden sm:inline-flex">
                  {next.name ?? 'Próximo episódio'}
                </Button>
                {model.rewatch && (
                  <span className="flex items-center gap-1">
                    <RewatchBadge />
                    <DismissRewatchButton label={`Tirar a revisão de ${series.name} do Continuar`} onClick={model.dismissRewatch} />
                  </span>
                )}
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

      <Overview text={series.overview} className="relative mt-8 max-w-3xl px-4 sm:px-6 lg:px-10" />
    </section>
  )
}
