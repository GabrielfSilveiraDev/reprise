import { useState } from 'react'
import { useEpisodeActions, useRewatchActions } from '@/api/mutations'
import { EpisodeCode } from '@/domain/EpisodeCode'
import type { ShelfItem } from '@/domain/NextUpShelf'
import { Fmt } from '@/lib/format'

/** Os textos de um item da fila — iguais nos três designs, para trocar de design não mudar o que se lê. */
export class ShelfText {
  static idle(days: number | null): string {
    if (days === null) return 'nunca assistida'
    if (days <= 0) return 'vista hoje'
    if (days === 1) return 'vista ontem'
    if (days < 60) return `vista há ${days} dias`
    if (days < 730) return `parada há ${Math.round(days / 30)} meses`
    return `parada há ${Math.round(days / 365)} anos`
  }

  /** "3 lançados por ver", "último lançado" ou "revendo". */
  static standing(entry: ShelfItem): string {
    if (entry.rewatch) return 'revendo'
    return entry.backlog && entry.backlog > 1 ? `${Fmt.plural(entry.backlog, 'lançado', 'lançados')} por ver` : 'último lançado'
  }

  static line(entry: ShelfItem): string {
    return `${ShelfText.standing(entry)} · ${ShelfText.idle(entry.daysIdle)}`
  }
}

/**
 * Um item da fila com as suas ações: marcar o próximo e, se for revisão, tirar do Continuar.
 *
 * Entre marcar e a fila recarregar, o item mostra "Visto" — o clique tem resposta antes de o
 * servidor dizer qual é o próximo, e o botão não aceita um segundo clique no mesmo episódio (que
 * seria uma revisão sem querer).
 */
export function useShelfItem(entry: ShelfItem) {
  const { item } = entry
  const { mark } = useEpisodeActions()
  const { dismiss } = useRewatchActions()
  const [markedId, setMarkedId] = useState<number | null>(null)
  const code = EpisodeCode.of(item.episode)

  return {
    item,
    code,
    rewatch: entry.rewatch,
    done: markedId === item.episode.id,
    pending: mark.isPending && mark.variables?.episode.id === item.episode.id,
    markLabel: `Marcar ${code.toSpoken()} de ${item.seriesName} como visto`,
    mark: () =>
      mark.mutate(
        { seriesId: item.seriesId, seriesName: item.seriesName, episode: item.episode },
        { onSuccess: () => setMarkedId(item.episode.id) },
      ),
    dismiss: () => dismiss.mutate({ seriesId: item.seriesId, seriesName: item.seriesName }),
    dismissLabel: `Tirar a revisão de ${item.seriesName} do Continuar`,
    series: { to: '/serie/$seriesId', params: { seriesId: item.seriesId } } as const,
    episode: { to: '/serie/$seriesId', params: { seriesId: item.seriesId }, search: { ep: item.episode.id } } as const,
    line: ShelfText.line(entry),
  }
}
