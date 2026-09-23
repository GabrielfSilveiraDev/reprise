import { clsx } from 'clsx'
import { CalendarClock, Check, ChevronsDown, Ellipsis, LoaderCircle, Minus, PanelRight, RotateCcw } from 'lucide-react'
import { useEpisodeActions } from '@/api/mutations'
import type { Episode, SeriesDetail } from '@/api/types'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { Button } from '@/ui/Button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/ui/Controls'

/** O que a página da série sabe fazer com um episódio, além de marcar e desmarcar. */
export interface EpisodeHandlers {
  onOpen: (episodeId: number) => void
  onMarkAt: (episode: Episode) => void
  onMarkUpTo: (episode: Episode) => void
}

/**
 * O círculo à esquerda de cada episódio. Vazio: um clique marca. Cheio: um clique abre as
 * opções — porque clicar de novo num episódio visto é ambíguo (desmarcar? rever?), e no Reprise
 * as duas coisas existem e são diferentes. Tracejado: ainda não saiu.
 */
export function WatchControl({
  series,
  episode,
  released,
  releaseLabel,
  handlers,
  size = 'md',
}: {
  series: Pick<SeriesDetail, 'id' | 'name'>
  episode: Episode
  released: boolean
  releaseLabel: string
  handlers: EpisodeHandlers
  size?: 'md' | 'lg'
}) {
  const { mark, unmark } = useEpisodeActions()
  const target = { seriesId: series.id, seriesName: series.name, episode }
  const code = EpisodeCode.of(episode)
  const busy = mark.isPending || unmark.isPending
  const dim = size === 'lg' ? 'size-11' : 'size-9'

  if (!released) {
    return (
      <span
        role="img"
        aria-label={`${code.toSpoken()} ainda não saiu: ${releaseLabel}`}
        title={releaseLabel}
        className={clsx(dim, 'shrink-0 rounded-full border-2 border-dashed border-line-strong')}
      />
    )
  }

  if (episode.watchCount === 0) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => mark.mutate(target)}
        aria-label={`Marcar ${code.toSpoken()} como visto`}
        className={clsx(
          dim,
          'group/watch grid shrink-0 place-items-center rounded-full border-2 border-line-strong transition-colors hover:border-accent hover:bg-accent-soft',
        )}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin text-ink-3" />
        ) : (
          <Check className="size-4 text-accent-ink opacity-0 transition-opacity group-hover/watch:opacity-100" strokeWidth={3} />
        )}
      </button>
    )
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={`${code.toSpoken()}: visto ${episode.watchCount} ${episode.watchCount === 1 ? 'vez' : 'vezes'}. Opções`}
          className={clsx(dim, 'grid shrink-0 animate-pop place-items-center rounded-full bg-accent text-accent-fg shadow-sm transition-[filter] hover:brightness-110')}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />}
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuItem icon={<RotateCcw />} onSelect={() => mark.mutate(target)} hint={`${episode.watchCount + 1}ª vez`}>
          Vi de novo agora
        </MenuItem>
        <MenuItem icon={<CalendarClock />} onSelect={() => handlers.onMarkAt(episode)}>
          Vi em outra data…
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Minus />} onSelect={() => unmark.mutate(target)}>
          Remover a última exibição
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/** O menu "⋯" da linha: o que não cabe no círculo. */
export function EpisodeMenu({ episode, released, pendingUpTo, handlers }: { episode: Episode; released: boolean; pendingUpTo: number; handlers: EpisodeHandlers }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${EpisodeCode.of(episode).toSpoken()}`}>
          <Ellipsis className="size-4" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<PanelRight />} onSelect={() => handlers.onOpen(episode.id)}>
          Detalhes
        </MenuItem>
        <MenuItem icon={<CalendarClock />} disabled={!released} onSelect={() => handlers.onMarkAt(episode)}>
          Vi em outra data…
        </MenuItem>
        {!episode.isSpecial && (
          <MenuItem
            icon={<ChevronsDown />}
            disabled={pendingUpTo === 0}
            onSelect={() => handlers.onMarkUpTo(episode)}
            hint={pendingUpTo > 0 ? String(pendingUpTo) : undefined}
          >
            Marcar até aqui
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  )
}
