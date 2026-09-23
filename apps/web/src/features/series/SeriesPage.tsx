import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ApiError } from '@/api/ApiError'
import { useEpisodeActions } from '@/api/mutations'
import { Queries } from '@/api/queries'
import type { Episode, SeriesDetail } from '@/api/types'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { EpisodeMap, type MapRow } from '@/domain/EpisodeMap'
import { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/ui/Feedback'
import { ConfirmDialog } from '@/ui/Overlay'
import { SectionTitle } from '@/ui/PageHeader'
import type { EpisodeHandlers } from './EpisodeControls'
import { EpisodeMapView, MapLegend } from './EpisodeMapView'
import { EpisodeSheet } from './EpisodeSheet'
import { SeasonPanel } from './SeasonPanel'
import { SeriesHero } from './SeriesHero'
import { SessionsTimeline } from './SessionsTimeline'
import { WatchDateDialog } from './WatchDateDialog'

const route = getRouteApi('/_app/serie/$seriesId')

type BulkRequest = { kind: 'season'; row: MapRow } | { kind: 'upTo'; episode: Episode; count: number }

export function SeriesPage() {
  const { seriesId } = route.useParams()
  const query = useQuery(Queries.seriesDetail(seriesId))

  if (query.isPending) return <SeriesSkeleton />
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <EmptyState title="Série não encontrada" action={<Button asChild variant="primary"><Link to="/acervo">Voltar ao acervo</Link></Button>}>
        Ela não existe no catálogo deste servidor.
      </EmptyState>
    ) : (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    )
  }
  return <SeriesView series={query.data} />
}

function SeriesView({ series }: { series: SeriesDetail }) {
  const { ep } = route.useSearch()
  const navigate = route.useNavigate()
  const [now] = useState(() => new Date())
  const clock = useMemo(() => new ReleaseClock(now), [now])
  const map = useMemo(() => new EpisodeMap(series, clock), [series, clock])

  const [chosenSeason, setChosenSeason] = useState<number | null>(null)
  const [markAt, setMarkAt] = useState<Episode | null>(null)
  const [bulk, setBulk] = useState<BulkRequest | null>(null)
  const { bulk: bulkMark } = useEpisodeActions()

  const activeSeason = chosenSeason ?? map.defaultSeason()
  const openEpisode = map.rows.flatMap((r) => r.cells).find((c) => c.episode.id === ep)?.episode ?? null

  const selectSeason = (season: number, scroll = false) => {
    setChosenSeason(season)
    if (scroll) document.getElementById('temporadas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlers: EpisodeHandlers = {
    onOpen: (id) => {
      const target = map.rows.flatMap((r) => r.cells).find((c) => c.episode.id === id)
      if (target) setChosenSeason(target.episode.seasonNumber)
      void navigate({ search: (s) => ({ ...s, ep: id }) })
    },
    onMarkAt: (episode) => setMarkAt(episode),
    onMarkUpTo: (episode) => setBulk({ kind: 'upTo', episode, count: map.pendingUpTo(episode) }),
  }

  const confirmBulk = () => {
    if (!bulk) return
    if (bulk.kind === 'season') bulkMark.mutate({ seriesId: series.id, season: bulk.row.season.seasonNumber })
    else bulkMark.mutate({ seriesId: series.id, season: bulk.episode.seasonNumber, upToEpisode: bulk.episode.episodeNumber })
  }

  return (
    <>
      <SeriesHero series={series} nextUp={map.nextUp} onOpenEpisode={handlers.onOpen} />

      <div className="space-y-14">
        {map.rows.length === 0 ? (
          <EmptyState title="Sem episódios no catálogo">
            Esta série ainda não passou pelo enriquecimento do TMDB. Rode <span className="code">enrich</span> no importador para trazer as temporadas.
          </EmptyState>
        ) : (
          <>
            <section aria-labelledby="mapa">
              <SectionTitle id="mapa" title="Mapa de episódios" hint="Cada quadrado é um episódio. Quanto mais quente, mais vezes você viu." />
              <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
                <EpisodeMapView
                  map={map}
                  clock={clock}
                  activeSeason={activeSeason}
                  onSelectSeason={(s) => selectSeason(s, true)}
                  onOpenEpisode={handlers.onOpen}
                />
                <div className="mt-5 border-t border-line pt-4">
                  <MapLegend />
                </div>
              </div>
            </section>

            <section id="temporadas" aria-labelledby="temporadas-titulo" className="scroll-mt-20">
              <h2 id="temporadas-titulo" className="sr-only">
                Temporadas
              </h2>
              <SeasonPanel
                series={series}
                map={map}
                clock={clock}
                active={activeSeason}
                onSelect={(s) => selectSeason(s)}
                onMarkSeason={(row) => setBulk({ kind: 'season', row })}
                handlers={handlers}
              />
            </section>
          </>
        )}

        <SessionsTimeline series={series} now={now} />
      </div>

      <EpisodeSheet
        series={series}
        episode={openEpisode}
        clock={clock}
        pendingUpTo={openEpisode ? map.pendingUpTo(openEpisode) : 0}
        onClose={() => void navigate({ search: (s) => ({ ...s, ep: undefined }) })}
        handlers={handlers}
      />

      <WatchDateDialog target={markAt ? { seriesId: series.id, seriesName: series.name, episode: markAt } : null} onClose={() => setMarkAt(null)} />

      <ConfirmDialog
        open={bulk !== null}
        onOpenChange={(open) => !open && setBulk(null)}
        title={bulk?.kind === 'season' ? `Marcar a temporada ${bulk.row.season.seasonNumber}?` : 'Marcar até aqui?'}
        confirmLabel={bulk ? `Marcar ${bulk.kind === 'season' ? bulk.row.pending : bulk.count}` : 'Marcar'}
        onConfirm={confirmBulk}
        description={
          bulk?.kind === 'season' ? (
            <p>
              {Fmt.plural(bulk.row.pending, 'episódio lançado e não visto recebe', 'episódios lançados e não vistos recebem')} uma exibição com a data de agora. Os já vistos e os que ainda não saíram ficam como estão.
            </p>
          ) : bulk?.kind === 'upTo' ? (
            <p>
              {Fmt.plural(bulk.count, 'episódio', 'episódios')} até <span className="code">{EpisodeCode.of(bulk.episode).toString()}</span> ganham uma exibição com a data de agora. Nada é marcado duas vezes.
            </p>
          ) : null
        }
      />
    </>
  )
}

function SeriesSkeleton() {
  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <Skeleton className="aspect-[2/3] w-40 rounded-xl lg:w-56" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-14 w-2/3" />
          <Skeleton className="h-10 w-72" />
        </div>
      </div>
      <Skeleton className="mt-14 h-48 rounded-card" />
    </div>
  )
}
