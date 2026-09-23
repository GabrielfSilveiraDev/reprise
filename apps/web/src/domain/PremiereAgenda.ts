import { format } from 'date-fns'
import type { Premiere } from '@/api/types'
import { Fmt } from '@/lib/format'
import { ReleaseClock } from './ReleaseClock'

export interface AgendaEntry {
  premiere: Premiere
  /** Quando libera, no relógio de quem olha. */
  instant: Date
}

export interface AgendaSection {
  key: string
  kind: 'day' | 'month'
  /** "Hoje", "Amanhã", "Quinta-feira", "Novembro". */
  title: string
  /** "25 de setembro", "2026". */
  subtitle: string
  entries: AgendaEntry[]
}

/**
 * A agenda de estreias agrupada do jeito que se planeja: dia a dia no curto prazo, mês a mês
 * no longo. Duas semanas de dias soltos é o que cabe na cabeça; uma estreia em março do ano que
 * vem não precisa do dia da semana para ser útil.
 *
 * O agrupamento é pelo dia LOCAL do instante de liberação — a estreia americana de quinta à noite
 * cai na sexta de quem está no Brasil, e é na sexta que ela precisa aparecer.
 */
export class PremiereAgenda {
  static readonly DAY_HORIZON = 14

  readonly entries: AgendaEntry[]

  constructor(
    premieres: readonly Premiere[],
    private readonly clock: ReleaseClock = new ReleaseClock(),
  ) {
    this.entries = premieres
      .map((premiere) => ({ premiere, instant: clock.instant(premiere) ?? new Date(premiere.airDate) }))
      .sort(
        (a, b) =>
          a.instant.getTime() - b.instant.getTime() ||
          a.premiere.seriesName.localeCompare(b.premiere.seriesName, 'pt-BR') ||
          a.premiere.episodeNumber - b.premiere.episodeNumber,
      )
  }

  /** O que libera nos próximos `days` dias de calendário (hoje incluso). */
  within(days: number): AgendaEntry[] {
    return this.entries.filter((e) => this.clock.daysUntil(e.instant) < days)
  }

  sections(options: { seasonPremieresOnly?: boolean } = {}): AgendaSection[] {
    const sections: AgendaSection[] = []
    const byKey = new Map<string, AgendaSection>()

    for (const entry of this.entries) {
      if (options.seasonPremieresOnly && !entry.premiere.isSeasonPremiere) continue

      const days = this.clock.daysUntil(entry.instant)
      const isNear = days < PremiereAgenda.DAY_HORIZON
      const key = isNear ? `d-${format(entry.instant, 'yyyy-MM-dd')}` : `m-${format(entry.instant, 'yyyy-MM')}`

      let section = byKey.get(key)
      if (!section) {
        section = isNear ? this.daySection(key, entry.instant, days) : this.monthSection(key, entry.instant)
        byKey.set(key, section)
        sections.push(section)
      }
      section.entries.push(entry)
    }
    return sections
  }

  private daySection(key: string, instant: Date, days: number): AgendaSection {
    const title = days <= 0 ? 'Hoje' : days === 1 ? 'Amanhã' : PremiereAgenda.capitalize(Fmt.pattern(instant, 'EEEE'))
    return { key, kind: 'day', title, subtitle: Fmt.pattern(instant, "d 'de' MMMM"), entries: [] }
  }

  private monthSection(key: string, instant: Date): AgendaSection {
    return {
      key,
      kind: 'month',
      title: PremiereAgenda.capitalize(Fmt.pattern(instant, 'MMMM')),
      subtitle: Fmt.pattern(instant, 'yyyy'),
      entries: [],
    }
  }

  private static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
}
