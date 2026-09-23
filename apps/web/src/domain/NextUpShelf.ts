import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { NextUpItem, SeriesListItem } from '@/api/types'
import { SeriesProgress } from './SeriesProgress'

export interface ShelfItem {
  item: NextUpItem
  /** Lançados e não vistos — vem da lista de séries, quando ela já está no cache. */
  backlog: number | null
  daysIdle: number | null
}

/**
 * A fila de "o que assistir agora", separada pelo que ela significa para a pessoa:
 *
 * - <b>em andamento</b>: mexeu nos últimos 30 dias — é a fila de verdade;
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
      const entry: ShelfItem = { item, backlog: backlogById.get(item.seriesId) ?? null, daysIdle }

      if (daysIdle === null) this.notStarted.push(entry)
      else if (daysIdle <= NextUpShelf.ACTIVE_DAYS) this.active.push(entry)
      else this.paused.push(entry)
    }
  }

  get isEmpty(): boolean {
    return this.active.length + this.paused.length + this.notStarted.length === 0
  }
}
