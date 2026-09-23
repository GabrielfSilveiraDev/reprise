import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useEpisodeActions } from '@/api/mutations'
import { EpisodeCode } from '@/domain/EpisodeCode'
import type { ShelfItem } from '@/domain/NextUpShelf'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Poster } from '@/ui/Poster'

function idleLabel(days: number | null): string {
  if (days === null) return 'nunca assistida'
  if (days <= 0) return 'vista hoje'
  if (days === 1) return 'vista ontem'
  if (days < 60) return `vista há ${days} dias`
  if (days < 730) return `parada há ${Math.round(days / 30)} meses`
  return `parada há ${Math.round(days / 365)} anos`
}

/**
 * O cartão da fila. Um toque em "Assisti" registra a exibição agora; a fila recarrega e o cartão
 * passa para o episódio seguinte. Entre um e outro ele mostra "Visto", para o clique ter resposta
 * mesmo antes de o servidor dizer qual é o próximo.
 */
export function NextUpCard({ entry, index }: { entry: ShelfItem; index: number }) {
  const { item, backlog, daysIdle } = entry
  const { mark } = useEpisodeActions()
  const [markedId, setMarkedId] = useState<number | null>(null)

  const done = markedId === item.episode.id
  const pending = mark.isPending && mark.variables?.episode.id === item.episode.id
  const code = EpisodeCode.of(item.episode)
  const series = { to: '/serie/$seriesId', params: { seriesId: item.seriesId } } as const

  return (
    <article
      className="group relative flex animate-rise gap-4 rounded-card border border-line bg-surface p-3 pr-4 transition-shadow hover:shadow-pop"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Link {...series} className="shrink-0" tabIndex={-1} aria-hidden>
        <Poster path={item.posterPath} name={item.seriesName} size="w154" sizes="88px" className="w-[88px]" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link {...series} className="headline line-clamp-2 text-[1.35rem] hover:text-accent-ink">
          {item.seriesName}
        </Link>
        <p className="mt-1.5 flex items-baseline gap-2 text-sm">
          <span className="code shrink-0 font-semibold text-accent-ink">{code.toString()}</span>
          <span className="truncate text-ink-2">{item.episode.name ?? 'Sem título'}</span>
        </p>
        <p className="mt-1 text-xs text-ink-3">
          {backlog && backlog > 1 ? `${Fmt.plural(backlog, 'lançado', 'lançados')} por ver` : 'último lançado'}
          {' · '}
          {idleLabel(daysIdle)}
        </p>

        <div className="mt-auto flex items-center gap-1 pt-3">
          <Button
            variant={done ? 'secondary' : 'primary'}
            size="sm"
            loading={pending}
            disabled={done}
            icon={<Check className={done ? 'size-4 animate-pop text-accent-ink' : 'size-4'} />}
            onClick={() =>
              mark.mutate(
                { seriesId: item.seriesId, seriesName: item.seriesName, episode: item.episode },
                { onSuccess: () => setMarkedId(item.episode.id) },
              )
            }
            aria-label={`Marcar ${code.toSpoken()} de ${item.seriesName} como visto`}
          >
            {done ? 'Visto' : 'Assisti'}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/serie/$seriesId" params={{ seriesId: item.seriesId }} search={{ ep: item.episode.id }}>
              Detalhes
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

/** Linha compacta para as prateleiras secundárias (parou no meio, para começar). */
export function CompactShelfRow({ entry }: { entry: ShelfItem }) {
  const { item, daysIdle } = entry
  const { mark } = useEpisodeActions()
  const code = EpisodeCode.of(item.episode)
  const pending = mark.isPending

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5">
      <Link to="/serie/$seriesId" params={{ seriesId: item.seriesId }} className="flex min-w-0 flex-1 items-center gap-3">
        <Poster path={item.posterPath} name={item.seriesName} size="w92" sizes="36px" className="w-9 shrink-0 rounded-md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.seriesName}</span>
          <span className="block truncate text-xs text-ink-3">
            <span className="code">{code.toString()}</span> · {idleLabel(daysIdle)}
          </span>
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        loading={pending}
        onClick={() => mark.mutate({ seriesId: item.seriesId, seriesName: item.seriesName, episode: item.episode })}
        aria-label={`Marcar ${code.toSpoken()} de ${item.seriesName} como visto`}
        icon={pending ? undefined : <Check className="size-4" />}
      />
    </div>
  )
}
