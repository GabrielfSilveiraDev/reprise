import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Queries } from '@/api/queries'
import type { StatsOverview } from '@/api/types'
import { Duration } from '@/domain/Duration'
import { HeatmapYear } from '@/domain/HeatmapYear'
import { StatsTimeline } from '@/domain/StatsTimeline'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Switch } from '@/ui/Controls'
import { ErrorState, Skeleton } from '@/ui/Feedback'
import { PageHeader, SectionTitle } from '@/ui/PageHeader'
import { ColumnChart } from './Charts'
import { YearHeatmap } from './YearHeatmap'

const route = getRouteApi('/_app/numeros')

export function StatsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const includeBackfill = search.lote ?? false
  const overview = useQuery(Queries.statsOverview(includeBackfill))

  const years = overview.data?.availableYears ?? []
  const year = search.ano && years.includes(search.ano) ? search.ano : (years[0] ?? new Date().getFullYear())

  return (
    <>
      <PageHeader
        title="Números"
        subtitle="Tudo derivado do seu histórico de exibições — nada é contado à parte."
        actions={
          <Switch
            checked={includeBackfill}
            onCheckedChange={(v) => void navigate({ search: (s) => ({ ...s, lote: v || undefined }) })}
            label="Incluir marcações em massa"
            description="Afeta só o que tem data"
          />
        }
      />

      {overview.isPending ? (
        <StatsSkeleton />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <StatsBody
          data={overview.data}
          year={year}
          includeBackfill={includeBackfill}
          onYear={(ano) => void navigate({ search: (s) => ({ ...s, ano }) })}
        />
      )}
    </>
  )
}

function StatsBody({ data, year, includeBackfill, onYear }: { data: StatsOverview; year: number; includeBackfill: boolean; onYear: (y: number) => void }) {
  const { summary, streaks } = data
  const total = Duration.ofSeconds(summary.totalSeconds)
  const headline = total.toHeadline()
  const calendar = useQuery(Queries.statsCalendar(year, includeBackfill))
  const [now] = useState(() => new Date())
  const heatmap = useMemo(() => (calendar.data ? new HeatmapYear(year, calendar.data, now) : null), [calendar.data, year, now])
  const months = useMemo(() => StatsTimeline.months(data.byMonth, year), [data.byMonth, year])
  const yearsSeries = useMemo(() => StatsTimeline.years(data.byYear), [data.byYear])
  const backfillShare = summary.exhibitions ? summary.backfillExhibitions / summary.exhibitions : 0

  const years = data.availableYears
  const index = years.indexOf(year)

  return (
    <div className="space-y-14">
      {/* Número-herói: um só, na fonte do corpo (não na de títulos). */}
      <section aria-label="Resumo" className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:items-end">
        <div>
          <p className="text-sm text-ink-3">Tempo diante da tela</p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="text-7xl font-semibold tracking-tight sm:text-8xl">{headline.value}</span>
            <span className="text-2xl text-ink-2">{headline.unit}</span>
          </p>
          <p className="mt-2 text-sm text-ink-2">
            {Fmt.plural(summary.exhibitions, 'exibição', 'exibições')} de {Fmt.plural(summary.seriesCount, 'série', 'séries')}
            {summary.firstWatchedAt && ` desde ${Fmt.pattern(parseISO(summary.firstWatchedAt), "MMMM 'de' yyyy")}`}.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Episódios diferentes" value={Fmt.compact(summary.distinctEpisodes)} />
          <Tile label="Revisitas" value={Fmt.percent(summary.rewatchRate)} note="das exibições foram de algo já visto" />
          <Tile
            label="Maior sequência"
            value={Fmt.plural(streaks.longestDays, 'dia', 'dias')}
            note={streaks.longestStartedAt && streaks.longestEndedAt ? `${Fmt.day(parseISO(streaks.longestStartedAt))} – ${Fmt.day(parseISO(streaks.longestEndedAt))}` : undefined}
          />
          <Tile label="Sequência atual" value={Fmt.plural(streaks.currentDays, 'dia', 'dias')} note={streaks.currentDays > 0 ? 'viu algo hoje ou ontem' : 'assista hoje para começar'} />
        </dl>
      </section>

      {backfillShare > 0.01 && (
        <p className="-mt-6 max-w-3xl rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
          {Fmt.plural(summary.backfillExhibitions, 'exibição veio', 'exibições vieram')} de marcações em massa ({Fmt.percent(backfillShare)}), que não têm data real.{' '}
          {includeBackfill
            ? 'Elas estão incluídas nas visões com data abaixo — e se concentram nos dias da importação.'
            : 'Contam nos totais acima, mas ficam fora do calendário, dos meses, dos anos e das sequências.'}
        </p>
      )}

      <section aria-labelledby="ano">
        <SectionTitle
          id="ano"
          title={`${year} dia a dia`}
          hint={heatmap ? `${Fmt.plural(heatmap.exhibitions, 'exibição', 'exibições')} em ${Fmt.plural(heatmap.activeDays, 'dia', 'dias')}${heatmap.busiest ? ` · recorde: ${Fmt.plural(heatmap.busiest.exhibitions, 'episódio', 'episódios')} em ${Fmt.day(heatmap.busiest.date, now)}` : ''}` : ' '}
          action={
            years.length > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Ano anterior" disabled={index === years.length - 1} onClick={() => onYear(years[index + 1]!)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="code w-12 text-center text-sm font-semibold">{year}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Ano seguinte" disabled={index <= 0} onClick={() => onYear(years[index - 1]!)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )
          }
        />
        <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
          {heatmap ? <YearHeatmap heatmap={heatmap} /> : calendar.isError ? <ErrorState error={calendar.error} /> : <Skeleton className="h-[140px]" />}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="meses">
          <SectionTitle id="meses" title="Por mês" hint={`Exibições em ${year}`} />
          <div className="rounded-card border border-line bg-surface p-4">
            <ColumnChart data={months} />
            <DataTable rows={months} caption={`Exibições por mês em ${year}`} />
          </div>
        </section>
        <section aria-labelledby="anos">
          <SectionTitle id="anos" title="Por ano" hint="Exibições com data real" />
          <div className="rounded-card border border-line bg-surface p-4">
            <ColumnChart data={yearsSeries} />
            <DataTable rows={yearsSeries} caption="Exibições por ano" />
          </div>
        </section>
      </div>

      <TopSeries data={data} />
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-ink-3">{note}</dd>}
    </div>
  )
}

/** A tabela por trás de cada gráfico — o valor exato, e o caminho para quem não vê as barras. */
function DataTable({ rows, caption }: { rows: ReturnType<typeof StatsTimeline.months>; caption: string }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-ink-3 hover:text-ink">Ver os números</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-ink-3">
          <tr>
            <th className="py-1 font-medium">Período</th>
            <th className="py-1 text-right font-medium">Exibições</th>
            <th className="py-1 text-right font-medium">Tempo</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="py-1">{r.full}</td>
              <td className="py-1 text-right">{Fmt.number(r.exhibitions)}</td>
              <td className="py-1 text-right">{Duration.ofSeconds(r.seconds).toShort()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/** Onde o tempo foi. Barras horizontais de uma cor; o número vai no fim da barra, em tinta de texto. */
function TopSeries({ data }: { data: StatsOverview }) {
  const top = data.topSeries
  const max = Math.max(1, ...top.map((t) => t.seconds))
  if (top.length === 0) return null
  return (
    <section aria-labelledby="top">
      <SectionTitle id="top" title="Onde o tempo foi" hint="As séries em que você passou mais horas, com revisitas" />
      <ol className="space-y-2.5">
        {top.map((t, i) => (
          <li key={t.seriesId}>
            <Link to="/serie/$seriesId" params={{ seriesId: t.seriesId }} className="group grid grid-cols-[1.5rem_minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[1.5rem_minmax(0,16rem)_minmax(0,1fr)]">
              <span className="code text-right text-xs text-ink-3">{i + 1}</span>
              <span className="truncate text-sm font-medium group-hover:text-accent-ink">{t.name}</span>
              <span className="flex items-center gap-2">
                <span className="h-3 rounded-r-[4px] bg-accent" style={{ width: `${(t.seconds / max) * 100}%`, minWidth: 3 }} />
                <span className="code shrink-0 text-xs text-ink-2">
                  {Duration.ofSeconds(t.seconds).toHours()}
                  <span className="hidden text-ink-3 sm:inline"> · {Fmt.plural(t.exhibitions, 'exib.', 'exib.')}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StatsSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_2fr]">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-56 rounded-card" />
    </div>
  )
}
