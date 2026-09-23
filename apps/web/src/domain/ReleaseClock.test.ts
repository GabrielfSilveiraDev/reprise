import { describe, expect, it } from 'vitest'
import { ReleaseClock } from './ReleaseClock'

// Quinta-feira, 24/09/2026, 18h em Brasília (21h UTC).
const NOW = new Date('2026-09-24T21:00:00Z')
const clock = new ReleaseClock(NOW)

describe('ReleaseClock', () => {
  it('roda no fuso de São Paulo nos testes', () => {
    expect(NOW.getHours()).toBe(18)
  })

  it('estreia americana de quinta à noite aparece como amanhã, no horário local', () => {
    // 00h do Pacífico de sexta = 04h de sexta em Brasília.
    const ep = { airDate: '2026-09-25', releasesAt: '2026-09-25T07:00:00Z' }
    expect(clock.state(ep)).toBe('upcoming')
    expect(clock.isReleased(ep)).toBe(false)
    expect(clock.label(ep)).toBe('libera amanhã às 04:00')
  })

  it('o que liberou mais cedo hoje conta como saído e pode ser marcado', () => {
    const ep = { airDate: '2026-09-24', releasesAt: '2026-09-24T12:00:00Z' }
    expect(clock.state(ep)).toBe('released')
    expect(clock.label(ep)).toBe('saiu hoje')
    expect(clock.isFresh(ep)).toBe(true)
  })

  it('usa o dia da semana até seis dias à frente', () => {
    const ep = { airDate: '2026-09-27', releasesAt: '2026-09-27T20:00:00Z' }
    expect(clock.label(ep)).toBe('libera domingo às 17:00')
  })

  it('episódio antigo mostra a data de exibição, não o instante de liberação', () => {
    const ep = { airDate: '2019-03-12', releasesAt: '2019-03-13T08:00:00Z' }
    expect(clock.label(ep)).toMatch(/^exibido em 12 de mar\.? de 2019$/)
    expect(clock.isFresh(ep)).toBe(false)
  })

  it('sem data não bloqueia a marcação — a API também aceita', () => {
    const ep = { airDate: null, releasesAt: null }
    expect(clock.state(ep)).toBe('undated')
    expect(clock.isReleased(ep)).toBe(true)
    expect(clock.label(ep)).toBe('sem data')
  })

  it('conta dias de calendário locais, não intervalos de 24h', () => {
    // 23h de hoje em Brasília já é amanhã em UTC, mas ainda é "hoje" para quem olha.
    expect(clock.daysUntil(new Date('2026-09-25T02:00:00Z'))).toBe(0)
    expect(clock.daysUntil(new Date('2026-09-25T03:30:00Z'))).toBe(1)
  })
})
