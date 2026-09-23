import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Fmt } from '@/lib/format'

export type ReleaseState = 'released' | 'upcoming' | 'undated'

/** O que o relógio precisa saber de um episódio. EpisodeDto e PremiereDto servem os dois. */
export interface Releasable {
  releasesAt: string | null
  airDate: string | null
}

/**
 * Responde "este episódio já saiu?" e "quando sai?" no fuso de QUEM ESTÁ OLHANDO.
 *
 * O servidor manda `releasesAt` já como instante absoluto — ele conhece o país de origem e a
 * agenda do TVmaze; o cliente só compara com o próprio relógio. Isso é o que faz a estreia de
 * sexta de madrugada aparecer como "amanhã" na quinta à tarde no Brasil.
 *
 * Esse instante só é hora de exibição de verdade na TV linear; em streaming é uma estimativa que
 * erra para mais tarde, nunca para mais cedo. Por isso a interface o chama de "libera": é o
 * momento a partir do qual o Reprise aceita marcar o episódio, e isso é verdade nos dois casos.
 */
export class ReleaseClock {
  constructor(readonly now: Date = new Date()) {}

  state(ep: Releasable): ReleaseState {
    if (ep.releasesAt) return parseISO(ep.releasesAt) <= this.now ? 'released' : 'upcoming'
    // Sem instante o servidor também não tem data — e, para ele, sem data conta como exibido.
    return 'undated'
  }

  /** Pode ser marcado? Mesma resposta que a API dá: sem data não impede. */
  isReleased(ep: Releasable): boolean {
    return this.state(ep) !== 'upcoming'
  }

  /** O instante de liberação, ou a data de exibição no começo do dia local, ou nada. */
  instant(ep: Releasable): Date | null {
    if (ep.releasesAt) return parseISO(ep.releasesAt)
    if (ep.airDate) return parseISO(ep.airDate)
    return null
  }

  /** Dias de calendário (no fuso local) até o instante. 0 = hoje, 1 = amanhã, -1 = ontem. */
  daysUntil(instant: Date): number {
    return differenceInCalendarDays(instant, this.now)
  }

  /** "hoje", "amanhã", "sexta", "26 de set." — o dia como a pessoa pensa nele. */
  dayLabel(instant: Date): string {
    const days = this.daysUntil(instant)
    if (days === 0) return 'hoje'
    if (days === 1) return 'amanhã'
    if (days === -1) return 'ontem'
    if (days > 1 && days < 7) return Fmt.pattern(instant, 'EEEE')
    return Fmt.day(instant, this.now)
  }

  /**
   * Rótulo curto para listas.
   * Futuro: "libera amanhã às 04:00". Passado recente: "saiu ontem". Passado: "exibido em 12 de mar. de 2019".
   */
  label(ep: Releasable): string {
    const instant = this.instant(ep)
    if (!instant) return 'sem data'

    if (this.state(ep) === 'upcoming') {
      return `libera ${this.dayLabel(instant)} às ${Fmt.time(instant)}`
    }

    const days = this.daysUntil(instant)
    if (days === 0) return 'saiu hoje'
    if (days === -1) return 'saiu ontem'
    if (days > -7) return `saiu ${Fmt.ago(instant, this.now)}`
    const aired = ep.airDate ? parseISO(ep.airDate) : instant
    return `exibido em ${Fmt.day(aired, this.now)}`
  }

  /** Saiu nos últimos `days` dias? Serve para o selo de "novo". */
  isFresh(ep: Releasable, days = 7): boolean {
    const instant = this.instant(ep)
    if (!instant || this.state(ep) !== 'released') return false
    return this.daysUntil(instant) > -days
  }
}
