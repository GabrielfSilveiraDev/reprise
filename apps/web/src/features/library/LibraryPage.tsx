import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowDownUp, Flag, LibraryBig, Plus, Search, Sparkles, X } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTrackingActions } from '@/api/mutations'
import { Queries } from '@/api/queries'
import type { SeriesListItem } from '@/api/types'
import { CompletionAdvisor } from '@/domain/CompletionAdvisor'
import { type LibraryFilter, type LibrarySort, LibraryView } from '@/domain/LibraryView'
import { ReturnNews } from '@/domain/ReturnNews'
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
  //
  // Só quando o texto difere da URL. Sem essa guarda, abrir o Acervo já agendava um `navigate`
  // para dali a 250 ms — e quem clicasse numa série nesse intervalo tinha a navegação cancelada
  // por ele, voltando para o Acervo sem aviso.
  const [text, setText] = useState(search.q ?? '')
  const urlText = search.q ?? ''
  useEffect(() => {
    if (text === urlText) return
    const id = setTimeout(() => void navigate({ search: (s) => ({ ...s, q: text || undefined }), replace: true }), 250)
    return () => clearTimeout(id)
  }, [text, urlText, navigate])

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

      {/* Em qualquer filtro: quem procura a série em Concluídas é justamente quem precisa saber que ela saiu de lá. */}
      {data && <ReturnBanner series={data} />}
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
    <LibraryNotice
      icon={<Flag className="size-5" />}
      title={suggested.length === 1 ? 'Uma série terminou e você viu tudo.' : `${suggested.length} séries terminaram e você viu tudo.`}
      action={
        <Button variant="primary" loading={applyMany.isPending} onClick={() => applyMany.mutate(advisor.toChanges(suggested))}>
          Mover para Concluídas
        </Button>
      }
    >
      {names.join(', ')}
      {rest > 0 && ` e mais ${rest}`}. Mover para Concluídas tira da fila e da agenda; o histórico fica.
    </LibraryNotice>
  )
}

/**
 * O outro lado da sugestão de concluir: as séries que a API devolveu sozinha para Assistindo porque
 * estreou temporada nova (ver `ReturnNews`). Não pede nada — a mudança já foi feita —, só conta o
 * que mudou e como desfazer, para que a série reaparecida não pareça um defeito. Some sozinho quando
 * você assiste a ela ou depois de duas semanas.
 */
function ReturnBanner({ series }: { series: readonly SeriesListItem[] }) {
  const returned = useMemo(() => new ReturnNews().of(series), [series])
  if (returned.length === 0) return null

  const shown = returned.slice(0, 3)
  const rest = returned.length - shown.length
  // Links, e não só nomes: na ordem por atividade a série que voltou fica lá embaixo, parada há anos.
  const link = (s: SeriesListItem, className: string) => (
    <Link to="/serie/$seriesId" params={{ seriesId: s.id }} className={`hover:text-accent-ink hover:underline ${className}`}>
      {s.name}
    </Link>
  )

  return (
    <LibraryNotice
      icon={<Sparkles className="size-5" />}
      title={returned.length === 1 ? <>{link(returned[0]!, '')} voltou para Assistindo.</> : `${returned.length} séries voltaram para Assistindo.`}
    >
      {returned.length > 1 && (
        <>
          {shown.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 && ', '}
              {link(s, 'font-medium text-ink-2')}
            </Fragment>
          ))}
          {rest > 0 && ` e mais ${rest}`}.{' '}
        </>
      )}
      {/* Sem dizer de onde ela veio: tanto Concluída quanto Arquivada voltam, e a lista não guarda qual era. */}
      Estreou temporada nova depois da última vez que você viu, e {returned.length === 1 ? 'ela está' : 'elas estão'} de novo na
      fila e na agenda. Não quer ver agora? Mude o estado de novo — só a próxima temporada{' '}
      {returned.length === 1 ? 'a traz' : 'traz cada uma'} de volta.
    </LibraryNotice>
  )
}

/** A moldura dos avisos do Acervo — o mesmo desenho nos três designs, vestido pelos tokens. */
function LibraryNotice({ icon, title, action, children }: { icon: ReactNode; title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-ink-3">{children}</p>
      </div>
      {action}
    </div>
  )
}
