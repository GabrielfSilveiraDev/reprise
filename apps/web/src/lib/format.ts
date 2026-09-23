import { format, formatDistanceStrict, isSameYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Formatação em pt-BR num lugar só. Classe estática porque não há estado: é um vocabulário,
 * e concentrá-lo evita que "12 mar. 2019" apareça escrito de três jeitos em três telas.
 */
export class Fmt {
  private static readonly integer = new Intl.NumberFormat('pt-BR')
  private static readonly compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

  static number(n: number): string {
    return Fmt.integer.format(n)
  }

  static compact(n: number): string {
    return n < 10_000 ? Fmt.integer.format(n) : Fmt.compactFmt.format(n)
  }

  static percent(ratio: number, digits = 0): string {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: digits }).format(ratio)
  }

  static pattern(date: Date, pattern: string): string {
    return format(date, pattern, { locale: ptBR })
  }

  /** "12 de mar." no ano corrente; "12 de mar. de 2019" fora dele. */
  static day(date: Date, now: Date = new Date()): string {
    return isSameYear(date, now) ? Fmt.pattern(date, "d 'de' MMM") : Fmt.pattern(date, "d 'de' MMM 'de' yyyy")
  }

  static time(date: Date): string {
    return Fmt.pattern(date, 'HH:mm')
  }

  /** "há 3 dias", "há 2 anos". */
  static ago(date: Date, now: Date = new Date()): string {
    if (now.getTime() - date.getTime() < 60_000) return 'agora há pouco'
    return formatDistanceStrict(date, now, { locale: ptBR, addSuffix: true })
  }

  /** "em 3 semanas". */
  static until(date: Date, now: Date = new Date()): string {
    return formatDistanceStrict(date, now, { locale: ptBR, addSuffix: true })
  }

  static plural(n: number, one: string, many: string): string {
    return `${Fmt.number(n)} ${n === 1 ? one : many}`
  }
}
