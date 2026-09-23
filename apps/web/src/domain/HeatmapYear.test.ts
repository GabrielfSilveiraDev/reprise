import { describe, expect, it } from 'vitest'
import { HeatmapYear } from './HeatmapYear'

describe('HeatmapYear', () => {
  const days = [
    { date: '2025-01-01', exhibitions: 1, seconds: 2400 },
    { date: '2025-01-02', exhibitions: 3, seconds: 7200 },
    { date: '2025-03-15', exhibitions: 9, seconds: 20000 },
    { date: '2025-12-31', exhibitions: 5, seconds: 9000 },
  ]
  const map = new HeatmapYear(2025, days, new Date(2025, 5, 30))

  it('monta colunas de semana começando no domingo', () => {
    // 01/01/2025 foi uma quarta: a primeira coluna tem domingo a terça vazios.
    expect(map.weeks).toHaveLength(53)
    expect(map.weeks[0]!.slice(0, 3)).toEqual([null, null, null])
    expect(map.weeks[0]![3]!.iso).toBe('2025-01-01')
    expect(map.weeks.flat().filter(Boolean)).toHaveLength(365)
  })

  it('usa degraus fixos: 1 · 2–3 · 4–6 · 7+', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 30].map((n) => HeatmapYear.level(n))).toEqual([0, 1, 2, 2, 3, 3, 4, 4])
  })

  it('soma o ano e acha o dia mais cheio', () => {
    expect(map.exhibitions).toBe(18)
    expect(map.activeDays).toBe(4)
    expect(map.busiest?.iso).toBe('2025-03-15')
  })

  it('marca os dias que ainda não chegaram', () => {
    const cells = map.weeks.flat().filter((c) => c !== null)
    expect(cells.find((c) => c.iso === '2025-06-30')!.future).toBe(false)
    expect(cells.find((c) => c.iso === '2025-07-01')!.future).toBe(true)
  })

  it('posiciona os rótulos de mês na coluna do dia 1', () => {
    expect(map.months).toHaveLength(12)
    expect(map.months[0]).toEqual({ label: 'jan', column: 0 })
  })
})
