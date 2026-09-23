import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import type { ShelfItem } from '@/domain/NextUpShelf'
import { Button } from '@/ui/Button'
import { Poster } from '@/ui/Poster'
import { DismissRewatchButton, RewatchBadge } from './RewatchBits'
import { ShelfText, useShelfItem } from './useShelfItem'

/**
 * O cartão da fila (Brasa). Um toque em "Assisti" registra a exibição agora; a fila recarrega e o
 * cartão passa para o episódio seguinte. Na revisão, um X tira a série do Continuar.
 */
export function NextUpCard({ entry, index }: { entry: ShelfItem; index: number }) {
  const s = useShelfItem(entry)
  const { item } = s

  return (
    <article
      className="group relative flex animate-rise gap-4 rounded-card border border-line bg-surface p-3 pr-4 transition-shadow hover:shadow-pop"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Link {...s.series} className="shrink-0" tabIndex={-1} aria-hidden>
        <Poster path={item.posterPath} name={item.seriesName} size="w154" sizes="88px" className="w-[88px]" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <Link {...s.series} className="headline line-clamp-2 flex-1 text-[1.35rem] hover:text-accent-ink">
            {item.seriesName}
          </Link>
          {s.rewatch && <DismissRewatchButton label={s.dismissLabel} onClick={s.dismiss} className="-mt-1 -mr-2" />}
        </div>
        <p className="mt-1.5 flex items-baseline gap-2 text-sm">
          <span className="code shrink-0 font-semibold text-accent-ink">{s.code.toString()}</span>
          <span className="truncate text-ink-2">{item.episode.name ?? 'Sem título'}</span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-ink-3">
          {s.rewatch && <RewatchBadge />}
          <span className="truncate">{s.rewatch ? ShelfText.idle(entry.daysIdle) : s.line}</span>
        </p>

        <div className="mt-auto flex items-center gap-1 pt-3">
          <Button
            variant={s.done ? 'secondary' : 'primary'}
            size="sm"
            loading={s.pending}
            disabled={s.done}
            icon={<Check className={s.done ? 'size-4 animate-pop text-accent-ink' : 'size-4'} />}
            onClick={s.mark}
            aria-label={s.markLabel}
          >
            {s.done ? 'Visto' : 'Assisti'}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link {...s.episode}>Detalhes</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

/** Linha compacta para as prateleiras secundárias (parou no meio, para começar). */
export function CompactShelfRow({ entry }: { entry: ShelfItem }) {
  const s = useShelfItem(entry)
  const { item } = s

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5">
      <Link {...s.series} className="flex min-w-0 flex-1 items-center gap-3">
        <Poster path={item.posterPath} name={item.seriesName} size="w92" sizes="36px" className="w-9 shrink-0 rounded-md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.seriesName}</span>
          <span className="block truncate text-xs text-ink-3">
            <span className="code">{s.code.toString()}</span> · {ShelfText.idle(entry.daysIdle)}
          </span>
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        loading={s.pending}
        onClick={s.mark}
        aria-label={s.markLabel}
        icon={s.pending ? undefined : <Check className="size-4" />}
      />
    </div>
  )
}
