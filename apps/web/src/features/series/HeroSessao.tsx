import { Check } from 'lucide-react'
import { TmdbImage } from '@/domain/TmdbImage'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Poster } from '@/ui/Poster'
import { RewatchBadge } from '../home/RewatchBits'
import { Overview } from './HeroParts'
import type { HeroModel } from './SeriesHero'
import { StatusMenu } from './StatusMenu'

/**
 * A capa da série na Sessão: a sala de projeção. O pôster vira a luz que enche a tela, o título
 * vem grande em serifa sobre ela, e o cartaz nítido fica ao lado, como na porta do cinema.
 */
export function HeroSessao({ model }: { model: HeroModel }) {
  const { series, progress, meta, tracked, next, nextCode } = model
  const backdrop = TmdbImage.url(series.posterPath, 'w342') // desfocado: resolução maior seria banda à toa
  const watched = progress.total ? (progress.watched / progress.total) * 100 : 0

  return (
    <section className="relative isolate -mx-4 -mt-6 mb-16 sm:-mx-6 lg:-mx-10 lg:-mt-10">
      {/* A luz vai de uma borda à outra da janela, além da coluna do conteúdo — a moldura da
          Sessão corta o excesso lateral (overflow-x-clip), então não nasce rolagem de lado. */}
      <div aria-hidden className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
        {backdrop && <img src={backdrop} alt="" className="size-full scale-110 object-cover opacity-70 blur-2xl saturate-125" />}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/40 to-transparent" />
      </div>

      <div className="grid items-end gap-10 px-4 pt-20 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-10 lg:pt-32 lg:pb-14">
        <div className="min-w-0">
          <p className="eyebrow">{meta.join('  ·  ')}</p>
          <h1 className="headline mt-4 text-6xl text-balance sm:text-7xl lg:text-8xl">{series.name}</h1>
          {series.originalName && series.originalName !== series.name && (
            <p className="mt-3 font-display text-2xl text-ink-3 italic">{series.originalName}</p>
          )}

          <Overview text={series.overview} className="mt-6 max-w-2xl text-lg" />

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {tracked && next && (
              <Button variant="primary" size="lg" loading={model.marking} icon={<Check className="size-5" />} onClick={model.markNext} className="px-7">
                Assisti <span className="code font-semibold">{nextCode}</span>
              </Button>
            )}
            <StatusMenu seriesId={series.id} status={series.status} />
            {tracked && next && (
              <Button variant="ghost" size="lg" onClick={() => model.openEpisode(next.id)} className="hidden font-display text-lg italic sm:inline-flex">
                {next.name ?? 'Próximo episódio'}
              </Button>
            )}
          </div>
          {model.rewatch && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              <RewatchBadge /> Você está revendo esta série.
              <button type="button" onClick={model.dismissRewatch} className="font-medium text-accent-ink hover:underline">
                Tirar do Continuar
              </button>
            </p>
          )}

          <div className="mt-8 flex max-w-md items-center gap-4">
            <div className="h-px flex-1 bg-line-strong" aria-hidden>
              <div className="h-px bg-accent" style={{ width: `${watched}%` }} />
            </div>
            <p className="shrink-0 text-sm text-ink-2">
              <span className="code text-ink">{Fmt.number(progress.watched)}</span>/{Fmt.number(progress.total)} · {progress.summary}
            </p>
          </div>
        </div>

        <Poster
          path={series.posterPath}
          name={series.name}
          size="w342"
          sizes="288px"
          eager
          className="hidden w-60 shadow-pop ring-1 ring-white/10 lg:block xl:w-72"
        />
      </div>
    </section>
  )
}
