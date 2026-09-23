import { Check } from 'lucide-react'
import { ProductionStatusInfo } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Poster } from '@/ui/Poster'
import { ProgressBar } from '@/ui/ProgressBar'
import { DismissRewatchButton, RewatchBadge } from '../home/RewatchBits'
import { Overview } from './HeroParts'
import type { HeroModel } from './SeriesHero'
import { StatusMenu } from './StatusMenu'

/**
 * A capa da série na Grade: a ficha técnica. Título grande e pesado, e os números da série em
 * células com fio, lidos numa linha — ano, produção, episódios, vistos, por ver. Sem desfoque,
 * sem gradiente: o pôster entra como foto de ficha.
 */
export function HeroGrade({ model }: { model: HeroModel }) {
  const { series, progress, tracked, next, nextCode, year } = model

  const facts: [string, string][] = [
    ['Ano', year ?? '—'],
    ['Produção', ProductionStatusInfo.label(series.productionStatus) ?? '—'],
    ['Episódios', Fmt.number(progress.total)],
    ['Vistos', Fmt.number(progress.watched)],
    ['Por ver', progress.backlog > 0 ? Fmt.number(progress.backlog) : '—'],
  ]

  return (
    <section className="mb-14 border-b-2 border-line-strong pb-10">
      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] lg:gap-10">
        <Poster path={series.posterPath} name={series.name} size="w342" sizes="(min-width: 1024px) 208px, 144px" eager className="w-36 border border-line-strong lg:w-52" />

        <div className="min-w-0">
          <p className="eyebrow">Série · nº {series.id}</p>
          <h1 className="headline mt-2 text-5xl text-balance sm:text-6xl lg:text-7xl">{series.name}</h1>
          {series.originalName && series.originalName !== series.name && <p className="code mt-2 text-sm text-ink-3">{series.originalName}</p>}

          <dl className="mt-6 grid grid-cols-2 border-t border-l border-line-strong sm:grid-cols-5">
            {facts.map(([label, value]) => (
              <div key={label} className="border-r border-b border-line-strong px-3 py-2">
                <dt className="eyebrow">{label}</dt>
                <dd className="code mt-0.5 truncate text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {tracked && next && (
              <Button variant="primary" loading={model.marking} icon={<Check className="size-4" />} onClick={model.markNext}>
                Assisti <span className="code font-semibold">{nextCode}</span>
              </Button>
            )}
            <StatusMenu seriesId={series.id} status={series.status} />
            {tracked && next && (
              <Button variant="ghost" onClick={() => model.openEpisode(next.id)} className="hidden sm:inline-flex">
                {next.name ?? 'Próximo episódio'}
              </Button>
            )}
            {model.rewatch && (
              <span className="flex items-center gap-1">
                <RewatchBadge />
                <DismissRewatchButton label={`Tirar a revisão de ${series.name} do Continuar`} onClick={model.dismissRewatch} />
              </span>
            )}
          </div>

          <div className="mt-6">
            <ProgressBar numbers={series} className="h-2" />
            <p className="code mt-2 text-xs text-ink-3 uppercase">
              {Fmt.percent(progress.ratio)} visto · {progress.summary}
            </p>
          </div>
        </div>
      </div>

      <Overview text={series.overview} className="mt-8 max-w-3xl" />
    </section>
  )
}
