import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { NextUpItem, SeriesListItem } from '@/api/types'
import { SeriesProgress } from './SeriesProgress'

export interface ShelfItem {
  item: NextUpItem
  /**
   * Lançados e não vistos — vem da lista de séries, quando ela já está no cache. Nulo na revisão:
   * quem está revendo não está "devendo" episódio nenhum, e o número confundiria.
   */
  backlog: number | null
  daysIdle: number | null
  /** Revendo: o episódio é o seguinte ao último repetido, não o primeiro inédito. */
  rewatch: boolean
}

/**
 * A fila de "o que assistir agora", separada pelo que ela significa para a pessoa:
 *
 * - <b>em andamento</b>: mexeu nos últimos 30 dias — é a fila de verdade, e é onde as revisões
 *   entram (o servidor só manda revisão com repetição nos últimos 30 dias);
 * - <b>parada</b>: já começou, mas faz tempo — lembrete, não pendência;
 * - <b>para começar</b>: acompanha e nunca assistiu nada.
 *
 * Sem isso, a tela inicial vira uma parede de 50 séries em que a que você está vendo esta semana
 * tem o mesmo peso da que largou em 2021.
 */
export class NextUpShelf {
  static readonly ACTIVE_DAYS = 30

  readonly active: ShelfItem[] = []
  readonly paused: ShelfItem[] = []
  readonly notStarted: ShelfItem[] = []

  constructor(nextUp: readonly NextUpItem[], series: readonly SeriesListItem[] | undefined, now: Date = new Date()) {
    const backlogById = new Map(series?.map((s) => [s.id, new SeriesProgress(s).backlog]))

    for (const item of nextUp) {
      const daysIdle = item.lastActivityAt ? differenceInCalendarDays(now, parseISO(item.lastActivityAt)) : null
      const rewatch = item.isRewatch
      const backlog = rewatch ? null : (backlogById.get(item.seriesId) ?? null)
      const entry: ShelfItem = { item, backlog, daysIdle, rewatch }

      if (rewatch) this.active.push(entry)
      else if (daysIdle === null) this.notStarted.push(entry)
      else if (daysIdle <= NextUpShelf.ACTIVE_DAYS) this.active.push(entry)
      else this.paused.push(entry)
    }
  }

  get isEmpty(): boolean {
    return this.active.length + this.paused.length + this.notStarted.length === 0
  }

  /** Episódios inéditos esperando nas séries em andamento (revisões não contam). */
  get waiting(): number {
    return this.active.filter((s) => !s.rewatch).reduce((sum, s) => sum + (s.backlog ?? 1), 0)
  }

  get rewatching(): number {
    return this.active.filter((s) => s.rewatch).length
  }
}
