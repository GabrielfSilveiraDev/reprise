import { addDays, differenceInCalendarDays, endOfWeek, format, getDay, parseISO, startOfWeek } from 'date-fns'
import type { CalendarDay } from '@/api/types'
import { Fmt } from '@/lib/format'

/** Degraus da escala sequencial (heat-0…4). O mesmo tipo serve ao mapa de episódios. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

export interface HeatCell {
  iso: string
  date: Date
  exhibitions: number
  seconds: number
  level: HeatLevel
  /** Dia que ainda não chegou — desenhado como vazio, não como "zero". */
  future: boolean
}

export interface MonthMark {
  label: string
  column: number
}

/**
 * Um ano de atividade em colunas de semana (domingo no topo, como o calendário brasileiro).
 *
 * <b>Degraus fixos, não quantis.</b> 1 · 2–3 · 4–6 · 7+ episódios num dia. Quantis se
 * reajustariam a cada ano e o mesmo tom significaria coisas diferentes em 2019 e em 2025 —
 * com degraus fixos a legenda diz um número que a pessoa entende e que vale para sempre.
 */
export class HeatmapYear {
  static readonly THRESHOLDS = [1, 2, 4, 7] as const

  static readonly LEGEND: readonly { level: HeatLevel; label: string }[] = [
    { level: 1, label: '1' },
    { level: 2, label: '2–3' },
    { level: 3, label: '4–6' },
    { level: 4, label: '7+' },
  ]

  readonly weeks: (HeatCell | null)[][]
  readonly months: MonthMark[]
  readonly exhibitions: number
  readonly seconds: number
  readonly activeDays: number
  readonly busiest: HeatCell | null

  constructor(
    readonly year: number,
    days: readonly CalendarDay[],
    today: Date = new Date(),
  ) {
    const byIso = new Map(days.map((d) => [d.date, d]))
    const jan1 = new Date(year, 0, 1)
    const dec31 = new Date(year, 11, 31)
    const first = startOfWeek(jan1, { weekStartsOn: 0 })
    const last = endOfWeek(dec31, { weekStartsOn: 0 })
    const columns = Math.round((differenceInCalendarDays(last, first) + 1) / 7)

    this.weeks = Array.from({ length: columns }, () => Array<HeatCell | null>(7).fill(null))
    this.months = []

    let exhibitions = 0
    let seconds = 0
    let activeDays = 0
    let busiest: HeatCell | null = null

    for (let date = jan1; date <= dec31; date = addDays(date, 1)) {
      const iso = format(date, 'yyyy-MM-dd')
      const day = byIso.get(iso)
      const cell: HeatCell = {
        iso,
        date,
        exhibitions: day?.exhibitions ?? 0,
        seconds: day?.seconds ?? 0,
        level: HeatmapYear.level(day?.exhibitions ?? 0),
        future: differenceInCalendarDays(date, today) > 0,
      }
      const column = Math.floor(differenceInCalendarDays(date, first) / 7)
      this.weeks[column]![getDay(date)] = cell

      if (date.getDate() === 1) this.months.push({ label: Fmt.pattern(date, 'MMM'), column })
      if (cell.exhibitions > 0) {
        exhibitions += cell.exhibitions
        seconds += cell.seconds
        activeDays += 1
        if (!busiest || cell.exhibitions > busiest.exhibitions) busiest = cell
      }
    }

    this.exhibitions = exhibitions
    this.seconds = seconds
    this.activeDays = activeDays
    this.busiest = busiest
  }

  static level(exhibitions: number): HeatLevel {
    const [one, two, four, seven] = HeatmapYear.THRESHOLDS
    if (exhibitions >= seven) return 4
    if (exhibitions >= four) return 3
    if (exhibitions >= two) return 2
    if (exhibitions >= one) return 1
    return 0
  }

  /** Converte a data ISO do servidor (dia sem hora) para uma data local. */
  static parse(iso: string): Date {
    return parseISO(iso)
  }
}
