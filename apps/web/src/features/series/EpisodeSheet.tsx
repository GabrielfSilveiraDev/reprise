import { parseISO } from 'date-fns'
import { CalendarClock, Check, ChevronsDown, Eye, Minus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useEpisodeActions } from '@/api/mutations'
import type { Episode, SeriesDetail } from '@/api/types'
import { Duration } from '@/domain/Duration'
import { EpisodeCode } from '@/domain/EpisodeCode'
import type { ReleaseClock } from '@/domain/ReleaseClock'
import { TmdbImage } from '@/domain/TmdbImage'
import { Fmt } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Overlay'
import type { EpisodeHandlers } from './EpisodeControls'

/**
 * Detalhe do episódio. A sinopse do TMDB descreve o que ACONTECE — é spoiler por natureza. Então:
 * episódio já visto mostra direto; não visto mostra borrada, e só revela com um clique.
 */
export function EpisodeSheet({
  series,
  episode,
  clock,
  pendingUpTo,
  onClose,
  handlers,
}: {
  series: SeriesDetail
  episode: Episode | null
  clock: ReleaseClock
  pendingUpTo: number
  onClose: () => void
  handlers: EpisodeHandlers
}) {
  return (
    <Sheet
      open={episode !== null}
      onOpenChange={(open) => !open && onClose()}
      title={episode ? `${EpisodeCode.of(episode).toString()} — ${episode.name ?? 'Sem título'}` : 'Episódio'}
    >
      {episode && <EpisodeDetail key={episode.id} series={series} episode={episode} clock={clock} pendingUpTo={pendingUpTo} handlers={handlers} />}
    </Sheet>
  )
}

function EpisodeDetail({
  series,
  episode,
  clock,
  pendingUpTo,
  handlers,
}: {
  series: SeriesDetail
  episode: Episode
  clock: ReleaseClock
  pendingUpTo: number
  handlers: EpisodeHandlers
}) {
  const { mark, unmark } = useEpisodeActions()
  const code = EpisodeCode.of(episode)
  const released = clock.isReleased(episode)
  const watched = episode.watchCount > 0
  const still = TmdbImage.url(episode.stillPath, 'w300')
  const target = { seriesId: series.id, seriesName: series.name, episode }

  const facts: [string, string][] = [
    [released ? 'Exibição' : 'Libera', clock.label(episode).replace(/^(exibido em|libera) /, '')],
    ['Duração', episode.runtimeSeconds ? Duration.ofSeconds(episode.runtimeSeconds).toShort() : '—'],
    ['Visto', watched ? `${episode.watchCount} ${episode.watchCount === 1 ? 'vez' : 'vezes'}` : 'ainda não'],
    ['Última vez', episode.lastWatchedAt ? Fmt.pattern(parseISO(episode.lastWatchedAt), "d 'de' MMM 'de' yyyy, HH:mm") : '—'],
  ]

  return (
    <div>
      <div className="relative aspect-video bg-surface-2">
        {still ? (
          <img
            src={still}
            srcSet={`${still} 300w, ${TmdbImage.url(episode.stillPath, 'original')} 1280w`}
            sizes="440px"
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <span className="code text-4xl font-semibold text-ink-3/60">{code.toString()}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
      </div>

      <div className="px-5 pt-2 pb-6">
        <p className="eyebrow">{series.name}</p>
        <p className="code mt-3 text-sm font-semibold text-accent-ink">{code.toString()}</p>
        <h2 className="headline mt-1 text-3xl text-balance">{episode.name ?? 'Sem título'}</h2>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <Synopsis text={episode.overview} revealed={watched} />

        <div className="mt-6 flex flex-col gap-2">
          {released ? (
            <>
              <Button variant="primary" size="lg" loading={mark.isPending} icon={watched ? <RotateCcw className="size-4" /> : <Check className="size-4" />} onClick={() => mark.mutate(target)}>
                {watched ? `Vi de novo agora (${episode.watchCount + 1}ª vez)` : 'Assisti agora'}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={() => handlers.onMarkAt(episode)}>
                  Outra data
                </Button>
                {watched ? (
                  <Button variant="secondary" loading={unmark.isPending} icon={<Minus className="size-4" />} onClick={() => unmark.mutate(target)}>
                    Remover última
                  </Button>
                ) : (
                  <Button variant="secondary" disabled={episode.isSpecial || pendingUpTo === 0} icon={<ChevronsDown className="size-4" />} onClick={() => handlers.onMarkUpTo(episode)}>
                    Até aqui ({pendingUpTo})
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-2">
              Este episódio ainda não saiu — {clock.label(episode)}. O Reprise libera a marcação nesse momento.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Synopsis({ text, revealed }: { text: string | null; revealed: boolean }) {
  const [show, setShow] = useState(revealed)

  if (!text) {
    return <p className="mt-5 text-sm text-ink-3">O TMDB ainda não tem sinopse para este episódio.</p>
  }

  return (
    <div className={show ? 'relative mt-5' : 'relative mt-5 min-h-24'}>
      <p className={show ? 'text-[15px] leading-relaxed text-ink-2' : 'text-[15px] leading-relaxed text-ink-2 blur-[6px] select-none'} aria-hidden={!show}>
        {text}
      </p>
      {!show && (
        <div className="absolute inset-0 grid place-items-center">
          <Button variant="outline" size="sm" className="bg-surface" icon={<Eye className="size-4" />} onClick={() => setShow(true)}>
            Mostrar sinopse — pode ter spoiler
          </Button>
        </div>
      )}
    </div>
  )
}
