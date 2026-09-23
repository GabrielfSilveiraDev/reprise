import { useQuery } from '@tanstack/react-query'
import { useEpisodeActions, useRewatchActions } from '@/api/mutations'
import { Queries } from '@/api/queries'
import type { Episode, SeriesDetail } from '@/api/types'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { SeriesProgress } from '@/domain/SeriesProgress'
import { ProductionStatusInfo } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { useDesigned } from '@/lib/useDesign'
import { HeroBrasa } from './HeroBrasa'
import { HeroGrade } from './HeroGrade'
import { HeroSessao } from './HeroSessao'

export interface HeroModel {
  series: SeriesDetail
  progress: SeriesProgress
  /** Ano, situação da produção, total de episódios. */
  meta: string[]
  year: string | undefined
  tracked: boolean
  /** O que o botão "Assisti" marca: o próximo da revisão, se houver uma em curso; senão o primeiro inédito. */
  next: Episode | null
  nextCode: string | null
  rewatch: boolean
  marking: boolean
  markNext: () => void
  dismissRewatch: () => void
  openEpisode: (id: number) => void
}

/**
 * A capa da série. O que ela diz é o mesmo nos três designs; a forma é de cada um — pôster sobre
 * a própria luz (Brasa), sala de projeção (Sessão), ficha técnica (Grade).
 */
export function SeriesHero({ series, nextUp, onOpenEpisode }: { series: SeriesDetail; nextUp: Episode | null; onOpenEpisode: (id: number) => void }) {
  const model = useHeroModel(series, nextUp, onOpenEpisode)
  return useDesigned({
    brasa: <HeroBrasa model={model} />,
    sessao: <HeroSessao model={model} />,
    grade: <HeroGrade model={model} />,
  })
}

function useHeroModel(series: SeriesDetail, firstUnwatched: Episode | null, openEpisode: (id: number) => void): HeroModel {
  const { mark } = useEpisodeActions()
  const { dismiss } = useRewatchActions()

  // A revisão é decidida no servidor, junto com a fila; aqui só se lê a resposta que a tela
  // inicial já pediu (ou pede agora, se a página foi aberta direto).
  const { data: rewatchItem } = useQuery({
    ...Queries.nextUp(),
    select: (items) => items.find((i) => i.seriesId === series.id && i.isRewatch) ?? null,
  })
  const rewatchNext = rewatchItem ? (series.seasons.flatMap((s) => s.episodes).find((e) => e.id === rewatchItem.episode.id) ?? null) : null

  const next = rewatchNext ?? firstUnwatched
  const year = series.firstAirDate?.slice(0, 4)

  return {
    series,
    progress: new SeriesProgress(series),
    meta: [year, ProductionStatusInfo.label(series.productionStatus), Fmt.plural(series.episodesTotal, 'episódio', 'episódios')].filter(
      (v): v is string => Boolean(v),
    ),
    year,
    tracked: series.status !== 'Untracked',
    next,
    nextCode: next ? EpisodeCode.of(next).toString() : null,
    rewatch: rewatchNext !== null,
    marking: mark.isPending,
    markNext: () => next && mark.mutate({ seriesId: series.id, seriesName: series.name, episode: next }),
    dismissRewatch: () => dismiss.mutate({ seriesId: series.id, seriesName: series.name }),
    openEpisode,
  }
}
