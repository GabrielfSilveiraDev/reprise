import { parseISO } from 'date-fns'
import { Fmt } from '@/lib/format'

/**
 * Quando uma temporada foi (ou vai) ao ar, em uma frase curta — para a prévia da busca, onde
 * importa mais "saiu em 2022" ou "estreia em 20 de out" do que as datas de cada episódio.
 *
 * As datas vêm do TMDB como dia, sem fuso (`2026-10-20`), e são comparadas como dia também.
 */
export class SeasonSpan {
  constructor(
    private readonly first: string | null,
    private readonly last: string | null,
    private readonly today: Date = new Date(),
  ) {}

  label(): string {
    if (!this.first) return 'sem data'
    const first = parseISO(this.first)
    const last = this.last ? parseISO(this.last) : first
    const todayKey = Fmt.pattern(this.today, 'yyyy-MM-dd')

    if (this.first > todayKey) return `estreia em ${Fmt.day(first, this.today)}`
    if (this.first === todayKey) return 'estreia hoje'
    if (this.last && this.last >= todayKey) return `no ar desde ${Fmt.day(first, this.today)}`

    const from = first.getFullYear()
    const to = last.getFullYear()
    return from === to ? String(from) : `${from}–${to}`
  }
}
