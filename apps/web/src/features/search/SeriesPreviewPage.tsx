import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { parseISO } from 'date-fns'
import { ArrowLeft, CalendarClock, KeyRound, Plus } from 'lucide-react'
import { ApiError } from '@/api/ApiError'
import { useAddSeries } from '@/api/mutations'
import { Queries } from '@/api/queries'
import type { SeriesPreview } from '@/api/types'
import { SeasonSpan } from '@/domain/SeasonSpan'
import { ProductionStatusInfo, TrackingStatusInfo } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/ui/Feedback'
import { Poster } from '@/ui/Poster'

const route = getRouteApi('/_app/buscar/$tmdbId')

/**
 * Uma série do TMDB antes de entrar no acervo: o que se vê ao tocar num resultado da busca. Sinopse,
 * situação da produção e as temporadas — o bastante para decidir se vale adicionar. Nada é gravado
 * até o "Adicionar". Se a série já está no acervo, o botão leva à página dela.
 *
 * Uma tela só nos três designs, vestida pelas variáveis, como Buscar e Agenda.
 */
export function SeriesPreviewPage() {
  const { tmdbId } = route.useParams()
  const preview = useQuery(Queries.seriesPreview(tmdbId))

  return (
    <>
      <BackToSearch />
      {preview.isPending ? (
        <div className="flex gap-5">
          <Skeleton className="aspect-[2/3] w-28 shrink-0 rounded-poster sm:w-44" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : preview.isError ? (
        preview.error instanceof ApiError && preview.error.isUnavailable ? (
          <EmptyState icon={<KeyRound />} title="Busca desligada neste servidor">
            {preview.error.message}
          </EmptyState>
        ) : (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        )
      ) : (
        <PreviewBody preview={preview.data} />
      )}
    </>
  )
}

/** Volta para a busca de onde veio (com o termo digitado); aberta por link direto, vai para a busca vazia. */
function BackToSearch() {
  const router = useRouter()
  const className = 'mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink'
  if (router.history.canGoBack()) {
    return (
      <button type="button" onClick={() => router.history.back()} className={className}>
        <ArrowLeft className="size-4" /> Voltar à busca
      </button>
    )
  }
  return (
    <Link to="/buscar" className={className}>
      <ArrowLeft className="size-4" /> Buscar séries
    </Link>
  )
}

function PreviewBody({ preview: p }: { preview: SeriesPreview }) {
  const add = useAddSeries()
  const navigate = useNavigate()
  const tracked = p.seriesId !== null && p.trackedStatus !== null
  const episodes = p.seasons.reduce((sum, s) => sum + s.episodeCount, 0)
  const meta = [
    p.firstAirDate?.slice(0, 4),
    ProductionStatusInfo.label(p.productionStatus),
    p.originCountry ? Region.name(p.originCountry) : null,
    p.seasons.length > 0 ? Fmt.plural(p.seasons.length, 'temporada', 'temporadas') : null,
    episodes > 0 ? Fmt.plural(episodes, 'episódio', 'episódios') : null,
    p.averageRuntimeMinutes ? `~${p.averageRuntimeMinutes} min` : null,
  ].filter(Boolean)

  const action = tracked ? (
    <Button asChild variant="outline">
      <Link to="/serie/$seriesId" params={{ seriesId: p.seriesId! }}>
        {TrackingStatusInfo.label(p.trackedStatus!)} · abrir
      </Link>
    </Button>
  ) : (
    <Button
      variant="primary"
      loading={add.isPending}
      icon={<Plus className="size-4" />}
      onClick={() => add.mutate(p.tmdbId, { onSuccess: (res) => void navigate({ to: '/serie/$seriesId', params: { seriesId: res.seriesId } }) })}
    >
      Adicionar ao acervo
    </Button>
  )

  return (
    <article className="animate-rise">
      <header className="flex gap-5 sm:gap-8">
        <Poster path={p.posterPath} name={p.name} size="w342" sizes="(min-width: 640px) 176px, 112px" eager className="w-28 shrink-0 sm:w-44" />
        <div className="min-w-0 flex-1">
          <h1 className="headline text-3xl text-balance sm:text-5xl">{p.name}</h1>
          {p.originalName && p.originalName !== p.name && <p className="mt-1 text-sm text-ink-3 italic">{p.originalName}</p>}
          {meta.length > 0 && <p className="mt-3 text-sm text-ink-2">{meta.join(' · ')}</p>}
          {p.nextAirDate && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink">
              <CalendarClock className="size-4" /> Próximo episódio: {NextAir.label(p.nextAirDate)}
            </p>
          )}
          <div className="mt-5 hidden sm:block">{action}</div>
        </div>
      </header>

      <div className="mt-5 sm:hidden">{action}</div>

      {p.overview && <p className="mt-6 max-w-3xl leading-relaxed text-ink-2">{p.overview}</p>}

      {p.seasons.length > 0 && (
        <section aria-labelledby="temporadas" className="mt-8 max-w-3xl">
          <h2 id="temporadas" className="headline mb-3 text-2xl">
            Temporadas
          </h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface grade:rounded-none">
            {p.seasons.map((s) => (
              <li key={s.seasonNumber} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="font-medium">Temporada {s.seasonNumber}</span>
                <span className="text-right text-sm text-ink-3">
                  {Fmt.plural(s.episodeCount, 'episódio', 'episódios')} · {new SeasonSpan(s.firstAirDate, s.lastAirDate).label()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

/** "hoje", "amanhã" ou a data — o próximo episódio na prévia. */
class NextAir {
  static label(date: string): string {
    const today = Fmt.pattern(new Date(), 'yyyy-MM-dd')
    const tomorrow = Fmt.pattern(new Date(Date.now() + 86_400_000), 'yyyy-MM-dd')
    if (date === today) return 'hoje'
    if (date === tomorrow) return 'amanhã'
    return Fmt.day(parseISO(date))
  }
}

/** O país de origem pelo nome em português ("JP" → "Japão"), com o próprio navegador traduzindo. */
class Region {
  private static readonly names = new Intl.DisplayNames(['pt-BR'], { type: 'region' })

  static name(code: string): string {
    try {
      return Region.names.of(code) ?? code
    } catch {
      return code
    }
  }
}
