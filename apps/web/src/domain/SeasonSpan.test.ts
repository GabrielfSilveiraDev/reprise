import { describe, expect, it } from 'vitest'
import { SeasonSpan } from './SeasonSpan'

// Terça-feira, 20/10/2026 — o dia em que Cyberpunk: Edgerunners 2 saiu inteira.
const today = new Date(2026, 9, 20, 15, 0)
const span = (first: string | null, last: string | null) => new SeasonSpan(first, last, today).label()

describe('SeasonSpan', () => {
  it('temporada antiga: o ano, ou o intervalo de anos', () => {
    expect(span('2022-09-13', '2022-09-13')).toBe('2022')
    expect(span('2019-11-01', '2020-02-14')).toBe('2019–2020')
  })

  it('a que sai hoje inteira, de uma vez', () => {
    expect(span('2026-10-20', '2026-10-20')).toBe('estreia hoje')
  })

  it('a que ainda vai estrear diz quando', () => {
    expect(span('2026-11-05', '2026-12-17')).toBe('estreia em 5 de nov')
  })

  it('a que está no ar, semana a semana', () => {
    expect(span('2026-10-01', '2026-11-19')).toBe('no ar desde 1 de out')
  })

  it('sem data nenhuma no TMDB', () => {
    expect(span(null, null)).toBe('sem data')
  })
})
