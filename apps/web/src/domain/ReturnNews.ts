import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { SeriesListItem } from '@/api/types'

type ReturnFacts = Pick<SeriesListItem, 'status' | 'returnedAt' | 'lastWatchedAt'>

/**
 * As séries que voltaram sozinhas para Assistindo porque estreou temporada nova, enquanto a volta
 * ainda é notícia.
 *
 * A decisão de voltar é da API (ver `SeriesReturns`, lá): é automática, e o simétrico do
 * `CompletionAdvisor`, que só sugere concluir. Mudança automática pede o contrário de
 * silêncio — sem isto, a série concluída reapareceria no meio da fila, parada há anos, e ninguém
 * saberia por quê. O papel do cliente é só contar: a série sobe para o Continuar com um selo, e o
 * Acervo diz quais voltaram e como desfazer.
 *
 * Deixa de ser notícia quando você assiste a um episódio dela depois da volta — aí é só mais uma
 * série em andamento — ou depois de {@link ReturnNews.DAYS} dias sem isso. Duas semanas cobrem o
 * atraso da volta (série encerrada é consultada no TMDB uma vez por semana) e ainda dão uma folga
 * para quem não abre o app todo dia, sem prender no topo uma temporada que você decidiu não ver.
 */
export class ReturnNews {
  static readonly DAYS = 14

  constructor(private readonly now: Date = new Date()) {}

  /** Quando voltou, se ainda é notícia; nulo se não é. */
  returnedAt(series: ReturnFacts): Date | null {
    // A API apaga a marca quando a pessoa muda o estado à mão; o estado aqui é só cinto e suspensório.
    if (series.status !== 'Following' || !series.returnedAt) return null
    const returned = parseISO(series.returnedAt)
    if (series.lastWatchedAt && parseISO(series.lastWatchedAt) > returned) return null
    return differenceInCalendarDays(this.now, returned) <= ReturnNews.DAYS ? returned : null
  }

  isNews(series: ReturnFacts): boolean {
    return this.returnedAt(series) !== null
  }

  /** As que ainda são notícia, a volta mais recente primeiro. */
  of<T extends ReturnFacts>(series: readonly T[]): T[] {
    return series
      .map((s) => ({ s, at: this.returnedAt(s) }))
      .filter((x): x is { s: T; at: Date } => x.at !== null)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((x) => x.s)
  }
}
