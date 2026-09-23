import type { TimeBucket } from '@/api/types'
import { Fmt } from '@/lib/format'

export interface BarDatum {
  key: string
  /** Rótulo do eixo ("mar", "2025"). */
  label: string
  /** Rótulo completo, para o tooltip e a tabela ("março de 2025"). */
  full: string
  exhibitions: number
  seconds: number
}

/**
 * Transforma os baldes da API em séries prontas para gráfico. A API só devolve períodos COM
 * atividade; um mês vazio precisa aparecer como zero, senão a coluna some e o eixo mente.
 */
export class StatsTimeline {
  /** Os 12 meses do ano, com zero onde não houve nada. Rótulos "YYYY-MM" vindos do servidor. */
  static months(byMonth: readonly TimeBucket[], year: number): BarDatum[] {
    const byLabel = new Map(byMonth.map((b) => [b.label, b]))
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`
      const date = new Date(year, i, 1)
      const bucket = byLabel.get(key)
      return {
        key,
        label: Fmt.pattern(date, 'MMM'),
        full: Fmt.pattern(date, "MMMM 'de' yyyy"),
        exhibitions: bucket?.exhibitions ?? 0,
        seconds: bucket?.seconds ?? 0,
      }
    })
  }

  /** Um ponto por ano, do primeiro ao último, com os anos sem atividade preenchidos. */
  static years(byYear: readonly TimeBucket[]): BarDatum[] {
    if (byYear.length === 0) return []
    const numbers = byYear.map((b) => Number(b.label))
    const first = Math.min(...numbers)
    const last = Math.max(...numbers)
    const byLabel = new Map(byYear.map((b) => [b.label, b]))
    return Array.from({ length: last - first + 1 }, (_, i) => {
      const label = String(first + i)
      const bucket = byLabel.get(label)
      return { key: label, label, full: label, exhibitions: bucket?.exhibitions ?? 0, seconds: bucket?.seconds ?? 0 }
    })
  }
}
