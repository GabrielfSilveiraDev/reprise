import { Link } from '@tanstack/react-router'
import { parseISO } from 'date-fns'
import type { SeriesListItem } from '@/api/types'
import { SeriesProgress } from '@/domain/SeriesProgress'
import { TrackingStatusInfo } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { Skeleton } from '@/ui/Feedback'
import { Poster } from '@/ui/Poster'
import { ProgressBar } from '@/ui/ProgressBar'

const COLUMNS = 'grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1.6fr)_7rem_minmax(0,1fr)_5rem_6rem]'

/**
 * O acervo da Grade: uma tabela. Cem séries se comparam melhor em colunas — quanto falta, quando
 * foi a última vez — do que em cem pôsteres. No celular, as colunas viram uma linha de legenda.
 *
 * É uma LISTA de links com cara de tabela, e não um `<table>`: cada linha leva à série, e uma
 * linha de tabela não pode ser um link sem deixar de ser, para o leitor de tela, uma das duas coisas.
 */
export function CollectionGrade({ series }: { series: SeriesListItem[] | null }) {
  return (
    <div className="border-t-2 border-line-strong">
      <div aria-hidden className={`hidden border-b border-line-strong py-2 sm:grid ${COLUMNS} gap-x-4`}>
        <span />
        <span className="eyebrow">Série</span>
        <span className="eyebrow">Estado</span>
        <span className="eyebrow">Progresso</span>
        <span className="eyebrow text-right">Por ver</span>
        <span className="eyebrow text-right">Última vez</span>
      </div>
      {series === null ? (
        Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="my-2 h-12 rounded-none" />)
      ) : (
        <ul aria-label="Séries do acervo">
          {series.map((s) => (
            <Row key={s.id} series={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ series }: { series: SeriesListItem }) {
  const progress = new SeriesProgress(series)
  const last = series.lastWatchedAt ? Fmt.pattern(parseISO(series.lastWatchedAt), 'dd.MM.yy') : '—'
  const numbers = `${Fmt.number(progress.watched)}/${Fmt.number(progress.total)}`

  return (
    <li>
      <Link
        to="/serie/$seriesId"
        params={{ seriesId: series.id }}
        className={`grid ${COLUMNS} items-center gap-x-4 border-b border-line py-2 transition-colors hover:bg-surface`}
      >
        <Poster path={series.posterPath} name={series.name} size="w92" sizes="40px" className="w-10" />
        <span className="min-w-0">
          <span className="block truncate font-semibold tracking-tight">{series.name}</span>
          <span className="block truncate text-xs text-ink-3 sm:hidden">
            {TrackingStatusInfo.label(series.status)} · <span className="code">{numbers}</span> · {progress.summary}
          </span>
        </span>
        <span className="code hidden text-[11px] tracking-wide text-ink-2 uppercase sm:block">{TrackingStatusInfo.label(series.status)}</span>
        <span className="hidden min-w-0 items-center gap-3 sm:flex">
          <ProgressBar numbers={series} className="flex-1" />
          <span className="code shrink-0 text-xs text-ink-2">{numbers}</span>
        </span>
        <span className={`code text-right text-sm font-semibold ${progress.backlog > 0 ? 'text-accent-ink' : 'text-ink-3'}`}>
          {progress.backlog > 0 ? Fmt.number(progress.backlog) : '—'}
          <span className="sr-only"> por ver</span>
        </span>
        <span className="code hidden text-right text-xs text-ink-3 sm:block">{last}</span>
      </Link>
    </li>
  )
}
