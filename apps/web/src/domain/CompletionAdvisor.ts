import type { SeriesListItem, TrackingChange } from '@/api/types'
import { SeriesProgress } from './SeriesProgress'

/**
 * Quem já pode ir para "Concluídas": série marcada como Assistindo, cuja produção acabou e da
 * qual a pessoa viu todos os episódios regulares.
 *
 * A API deixa esta regra com o cliente de propósito e só aplica o resultado em lote. Aqui ela
 * vira SUGESTÃO, não ação automática: mover uma série de estado sem a pessoa pedir é o tipo de
 * surpresa que faz alguém desconfiar do app. Um botão, e a decisão fica com ela.
 */
export class CompletionAdvisor {
  suggest(series: readonly SeriesListItem[]): SeriesListItem[] {
    return series.filter((s) => s.status === 'Following' && new SeriesProgress(s).phase === 'complete')
  }

  toChanges(series: readonly SeriesListItem[]): TrackingChange[] {
    return series.map((s) => ({ seriesId: s.id, status: 'Finished' }))
  }
}
