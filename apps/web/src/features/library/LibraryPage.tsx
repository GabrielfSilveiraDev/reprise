import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowDownUp, Flag, LibraryBig, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTrackingActions } from '@/api/mutations'
import { Queries } from '@/api/queries'
import type { SeriesListItem } from '@/api/types'
import { CompletionAdvisor } from '@/domain/CompletionAdvisor'
import { type LibraryFilter, type LibrarySort, LibraryView } from '@/domain/LibraryView'
import { TrackingStatusInfo } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { useDesigned } from '@/lib/useDesign'
import { Button } from '@/ui/Button'
import { Menu, MenuContent, MenuLabel, MenuRadio, MenuTrigger, Segmented } from '@/ui/Controls'
import { EmptyState, ErrorState } from '@/ui/Feedback'
import { PageHeader } from '@/ui/PageHeader'
import { CollectionBrasa } from './CollectionBrasa'
import { CollectionGrade } from './CollectionGrade'
import { CollectionSessao } from './CollectionSessao'

const route = getRouteApi('/_app/acervo')

const SORT_OPTIONS: { value: LibrarySort; label: string; hint: string }[] = [
  { value: 'atividade', label: 'Atividade recente', hint: 'O que você viu por último primeiro' },
  { value: 'pendentes', label: 'Mais episódios por ver', hint: 'Lançados e ainda não vistos' },
  { value: 'progresso', label: 'Mais perto do fim', hint: 'Pela fração vista' },
  { value: 'nome', label: 'Nome', hint: 'A–Z' },
]

export function LibraryPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const filter: LibraryFilter = search.estado ?? 'Following'
  const sort: LibrarySort = search.ordem ?? 'atividade'

  // O texto é estado local para digitar sem engasgo; a URL acompanha com um pequeno atraso.
  const [text, setText] = useState(search.q ?? '')
  useEffect(() => {
    const id = setTimeout(() => void navigate({ search: (s) => ({ ...s, q: text || undefined }), replace: true }), 250)
    return () => clearTimeout(id)
  }, [text, navigate])

  const { data, isPending, isError, error, refetch } = useQuery(Queries.seriesList())
  const { counts, visible } = useMemo(() => {
    const view = new LibraryView(data ?? [])
    return { counts: view.counts(), visible: view.apply({ filter, sort, text }) }
  }, [data, filter, sort, text])

  const filterOptions = (['Following', 'ForLater', 'Finished', 'Archived', 'todas'] as const).map((value) => ({
    value,
    label: value === 'todas' ? 'Todas' : TrackingStatusInfo.plural(value),
    count: counts[value],
  }))

  // A barra de filtros é a mesma nos três designs; a coleção é de cada um. `null` = carregando.
  const shown = isPending ? null : visible
  const collection = useDesigned({
    brasa: <CollectionBrasa series={shown} />,
    sessao: <CollectionSessao series={shown} />,
    grade: <CollectionGrade series={shown} />,
  })

  return (
    <>
      <PageHeader
        eyebrow={data ? Fmt.plural(data.length, 'série', 'séries') : 'Acervo'}
        title="Acervo"
        actions={
          <Button asChild variant="primary" icon={<Plus className="size-4" />}>
            <Link to="/buscar">Adicionar</Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented
            label="Filtrar por estado"
            value={filter}
            onChange={(estado) => void navigate({ search: (s) => ({ ...s, estado: estado === 'Following' ? undefined : estado }) })}
            options={filterOptions}
          />
        </div>
        <div className="flex flex-1 items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Filtrar pelo nome</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filtrar pelo nome"
              className="h-10 w-full rounded-control border border-line bg-surface pr-9 pl-9 text-sm outline-none placeholder:text-ink-3 focus:border-line-strong"
            />
            {text && (
              <button type="button" onClick={() => setText('')} aria-label="Limpar filtro" className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2">
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="outline" icon={<ArrowDownUp className="size-4" />} aria-label="Ordenar">
                <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sort)?.label}</span>
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Ordenar por</MenuLabel>
              <MenuRadio value={sort} onChange={(ordem) => void navigate({ search: (s) => ({ ...s, ordem: ordem === 'atividade' ? undefined : ordem }) })} options={SORT_OPTIONS} />
            </MenuContent>
          </Menu>
        </div>
      </div>

      {data && (filter === 'Following' || filter === 'todas') && <CompletionBanner series={data} />}

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !isPending && visible.length === 0 ? (
        <EmptyState icon={<LibraryBig />} title={text ? 'Nenhuma série com esse nome' : 'Nada aqui ainda'}>
          {text
            ? `Nenhuma série em ${filter === 'todas' ? 'todo o acervo' : TrackingStatusInfo.plural(filter).toLowerCase()} tem “${text}” no nome.`
            : TrackingStatusInfo.hint(filter === 'todas' ? 'Following' : filter)}
        </EmptyState>
      ) : (
        collection
      )}
    </>
  )
}

/**
 * A sugestão de concluir: aparece só quando há o que sugerir, lista as séries pelo nome e
 * move todas com um clique — ou nenhuma, se a pessoa ignorar.
 */
function CompletionBanner({ series }: { series: readonly SeriesListItem[] }) {
  const advisor = useMemo(() => new CompletionAdvisor(), [])
  const suggested = useMemo(() => advisor.suggest(series), [advisor, series])
  const { applyMany } = useTrackingActions()
  if (suggested.length === 0) return null

  const names = suggested.slice(0, 3).map((s) => s.name)
  const rest = suggested.length - names.length

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
        <Flag className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          {suggested.length === 1 ? 'Uma série terminou e você viu tudo.' : `${suggested.length} séries terminaram e você viu tudo.`}
        </p>
        <p className="mt-0.5 text-ink-3">
          {names.join(', ')}
          {rest > 0 && ` e mais ${rest}`}. Mover para Concluídas tira da fila e da agenda; o histórico fica.
        </p>
      </div>
      <Button variant="primary" loading={applyMany.isPending} onClick={() => applyMany.mutate(advisor.toChanges(suggested))}>
        Mover para Concluídas
      </Button>
    </div>
  )
}
