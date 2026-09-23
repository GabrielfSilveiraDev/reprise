import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { KeyRound, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/api/ApiError'
import { useAddSeries } from '@/api/mutations'
import { Queries } from '@/api/queries'
import type { SearchResult } from '@/api/types'
import { LibraryView } from '@/domain/LibraryView'
import { TrackingStatusInfo } from '@/domain/TrackingStatus'
import { useDebounced } from '@/lib/useDebounced'
import { Button } from '@/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/ui/Feedback'
import { PageHeader } from '@/ui/PageHeader'
import { Poster } from '@/ui/Poster'

const route = getRouteApi('/_app/buscar')

export function SearchPage() {
  const { q } = route.useSearch()
  const navigate = route.useNavigate()
  const [text, setText] = useState(q ?? '')
  const term = useDebounced(text.trim(), 350)

  useEffect(() => {
    void navigate({ search: { q: term || undefined }, replace: true })
  }, [term, navigate])

  const results = useQuery(Queries.search(term))
  const library = useQuery(Queries.seriesList())
  const inLibrary = useMemo(() => {
    const needle = LibraryView.fold(term)
    if (needle.length < 2 || !library.data) return []
    return library.data.filter((s) => LibraryView.fold(s.name).includes(needle)).slice(0, 6)
  }, [library.data, term])

  return (
    <>
      <PageHeader title="Adicionar série" subtitle="Procure no catálogo do TMDB. O que você adicionar entra em “Assistindo”." />

      <label className="relative block">
        <span className="sr-only">Nome da série</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Severance, Dark, Pokémon…"
          className="h-14 w-full rounded-control border border-line bg-surface pr-12 pl-12 text-lg outline-none placeholder:text-ink-3 focus:border-line-strong focus:shadow-pop"
        />
        {text && (
          <button type="button" onClick={() => setText('')} aria-label="Limpar" className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface-2">
            <X className="size-4" />
          </button>
        )}
      </label>

      {inLibrary.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-2">Já no seu acervo</p>
          <div className="flex flex-wrap gap-2">
            {inLibrary.map((s) => (
              <Link key={s.id} to="/serie/$seriesId" params={{ seriesId: s.id }} className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface py-1 pr-3 pl-1 text-sm hover:border-line-strong">
                <Poster path={s.posterPath} name={s.name} size="w92" sizes="24px" className="w-6 rounded-pill" />
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {term.length < 2 ? (
          <EmptyState icon={<Search />} title="Comece a digitar">
            A busca usa o nome em qualquer idioma — o original, o em inglês ou o traduzido.
          </EmptyState>
        ) : results.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
          </div>
        ) : results.isError ? (
          results.error instanceof ApiError && results.error.isUnavailable ? (
            <EmptyState icon={<KeyRound />} title="Busca desligada neste servidor">
              {results.error.message}
            </EmptyState>
          ) : (
            <ErrorState error={results.error} onRetry={() => void results.refetch()} />
          )
        ) : results.data.length === 0 ? (
          <EmptyState title={`Nada para “${term}”`}>Tente o nome original ou em inglês.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {results.data.map((r) => (
              <ResultRow key={r.tmdbId} result={r} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ResultRow({ result: r }: { result: SearchResult }) {
  const add = useAddSeries()
  const navigate = useNavigate()
  const year = r.firstAirDate?.slice(0, 4)
  const tracked = r.seriesId !== null && r.trackedStatus !== null
  const action = tracked ? (
    <Button asChild variant="outline" size="sm">
      <Link to="/serie/$seriesId" params={{ seriesId: r.seriesId! }}>
        {TrackingStatusInfo.label(r.trackedStatus!)} · abrir
      </Link>
    </Button>
  ) : (
    <Button
      variant="primary"
      size="sm"
      loading={add.isPending}
      icon={<Plus className="size-4" />}
      onClick={() => add.mutate(r.tmdbId, { onSuccess: (res) => void navigate({ to: '/serie/$seriesId', params: { seriesId: res.seriesId } }) })}
    >
      Adicionar
    </Button>
  )

  return (
    <li className="flex animate-rise gap-4 rounded-card border border-line bg-surface p-3 sm:p-4">
      <Poster path={r.posterPath} name={r.name} size="w154" sizes="80px" className="w-16 shrink-0 sm:w-20" />
      <div className="min-w-0 flex-1">
        <p className="headline text-xl">
          {r.name} {year && <span className="font-sans text-sm font-normal text-ink-3">{year}</span>}
        </p>
        {r.originalName && r.originalName !== r.name && <p className="text-xs text-ink-3 italic">{r.originalName}</p>}
        {r.overview && <p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{r.overview}</p>}
        <div className="mt-3 sm:hidden">
          {action}
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        {action}
      </div>
    </li>
  )
}
