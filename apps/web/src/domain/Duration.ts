import { Fmt } from '@/lib/format'

/** Tempo assistido. Guarda segundos — a unidade da API — e só vira texto na borda. */
export class Duration {
  private constructor(readonly seconds: number) {}

  static ofSeconds(seconds: number | null | undefined): Duration {
    return new Duration(Math.max(0, seconds ?? 0))
  }

  get minutes(): number {
    return this.seconds / 60
  }

  get hours(): number {
    return this.seconds / 3600
  }

  get days(): number {
    return this.seconds / 86_400
  }

  /** "45 min", "1 h 20 min", "3 d 4 h" — para metadados em linha. */
  toShort(): string {
    const totalMinutes = Math.round(this.minutes)
    if (totalMinutes < 60) return `${totalMinutes} min`
    const totalHours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (totalHours < 24) return minutes ? `${totalHours} h ${minutes} min` : `${totalHours} h`
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    return hours ? `${days} d ${hours} h` : `${days} d`
  }

  /**
   * A maior unidade que ainda dá um número legível, para números-herói:
   * 212 dias, 36 horas, 50 minutos. Arredonda — a precisão está no subtítulo.
   */
  toHeadline(): { value: string; unit: string } {
    if (this.hours >= 72) {
      const d = Math.round(this.days)
      return { value: Fmt.number(d), unit: d === 1 ? 'dia' : 'dias' }
    }
    if (this.minutes >= 90) {
      const h = Math.round(this.hours)
      return { value: Fmt.number(h), unit: h === 1 ? 'hora' : 'horas' }
    }
    const m = Math.round(this.minutes)
    return { value: Fmt.number(m), unit: m === 1 ? 'minuto' : 'minutos' }
  }

  /** "1.234 h" — horas cheias, para rankings e eixos. */
  toHours(): string {
    return `${Fmt.number(Math.round(this.hours))} h`
  }
}
