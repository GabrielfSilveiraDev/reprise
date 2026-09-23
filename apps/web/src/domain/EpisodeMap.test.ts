import { describe, expect, it } from 'vitest'
import { Make } from '@/test/factories'
import { Duration } from './Duration'
import { EpisodeCode } from './EpisodeCode'
import { EpisodeMap } from './EpisodeMap'
import { NextUpShelf } from './NextUpShelf'
import { ReleaseClock } from './ReleaseClock'

const clock = new ReleaseClock(new Date('2026-09-24T21:00:00Z'))
const FUTURE = { airDate: '2026-10-01', releasesAt: '2026-10-01T07:00:00Z' }

describe('EpisodeMap', () => {
  const detail = Make.detail([
    Make.season(1, [{ watchCount: 1 }, { watchCount: 3 }, { watchCount: 0 }, { watchCount: 1 }]),
    Make.season(2, [{ watchCount: 0 }, { watchCount: 0 }, FUTURE]),
    Make.season(0, [{ watchCount: 0 }, { watchCount: 6 }]),
  ])
  const map = new EpisodeMap(detail, clock)

  it('o próximo é o buraco no meio, não o seguinte ao último visto', () => {
    expect(map.nextUp && EpisodeCode.of(map.nextUp).toString()).toBe('S01E03')
    expect(map.rows[0]!.cells.filter((c) => c.isNext)).toHaveLength(1)
  })

  it('a cor é a contagem de exibições, com teto em 4+', () => {
    expect(map.rows[0]!.cells.map((c) => c.level)).toEqual([1, 3, 0, 1])
    expect(map.rows[2]!.cells[1]!.level).toBe(4)
    expect(map.maxWatchCount).toBe(6)
  })

  it('episódio por lançar não é pendência', () => {
    const t2 = map.row(2)!
    expect(t2.cells.map((c) => c.state)).toEqual(['unwatched', 'unwatched', 'upcoming'])
    expect(t2.pending).toBe(2)
    expect(t2.released).toBe(2)
  })

  it('especiais têm rótulo próprio e nunca são o próximo', () => {
    expect(map.rows[2]!.label).toBe('Esp.')
    const onlySpecials = new EpisodeMap(Make.detail([Make.season(0, [{ watchCount: 0 }])]), clock)
    expect(onlySpecials.nextUp).toBeNull()
  })

  it('conta o que "marcar até aqui" criaria', () => {
    const target = map.row(2)!.cells[0]!.episode
    expect(map.pendingUpTo(target)).toBe(2) // S01E03 e S02E01
  })

  it('abre na temporada do próximo episódio', () => {
    expect(map.defaultSeason()).toBe(1)
    const allSeen = new EpisodeMap(Make.detail([Make.season(1, [{ watchCount: 1 }]), Make.season(2, [{ watchCount: 2 }, FUTURE])]), clock)
    expect(allSeen.defaultSeason()).toBe(2)
  })
})

describe('NextUpShelf', () => {
  const now = new Date('2026-09-24T21:00:00Z')
  it('separa em andamento, parada e para começar', () => {
    const active = Make.nextUp({ seriesName: 'A', lastActivityAt: '2026-09-20T22:00:00Z' })
    const paused = Make.nextUp({ seriesName: 'P', lastActivityAt: '2025-01-01T22:00:00Z' })
    const fresh = Make.nextUp({ seriesName: 'N', lastActivityAt: null })
    const series = [Make.seriesItem({ id: active.seriesId, episodesAired: 20, episodesWatched: 12 })]

    const shelf = new NextUpShelf([active, paused, fresh], series, now)
    expect(shelf.active.map((s) => [s.item.seriesName, s.backlog, s.daysIdle])).toEqual([['A', 8, 4]])
    expect(shelf.paused.map((s) => s.item.seriesName)).toEqual(['P'])
    expect(shelf.notStarted.map((s) => s.backlog)).toEqual([null])
  })
})

describe('Duration e EpisodeCode', () => {
  it('formata tempo curto e número-herói', () => {
    expect(Duration.ofSeconds(2700).toShort()).toBe('45 min')
    expect(Duration.ofSeconds(4800).toShort()).toBe('1 h 20 min')
    expect(Duration.ofSeconds(3 * 86_400 + 4 * 3600).toShort()).toBe('3 d 4 h')
    expect(Duration.ofSeconds(212 * 86_400).toHeadline()).toEqual({ value: '212', unit: 'dias' })
    expect(Duration.ofSeconds(36 * 3600).toHeadline()).toEqual({ value: '36', unit: 'horas' })
    expect(Duration.ofSeconds(null).toShort()).toBe('0 min')
  })

  it('escreve o código do episódio', () => {
    expect(new EpisodeCode(2, 5).toString()).toBe('S02E05')
    expect(new EpisodeCode(0, 3).toSpoken()).toBe('Especial 3')
  })
})
