import { describe, expect, it } from 'vitest'
import { Make } from '@/test/factories'
import { NextUpShelf } from './NextUpShelf'

const NOW = new Date('2026-09-24T21:00:00-03:00')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

describe('NextUpShelf', () => {
  it('separa em andamento, parada e para começar pela última atividade', () => {
    const shelf = new NextUpShelf(
      [
        Make.nextUp({ seriesName: 'Ontem', lastActivityAt: daysAgo(1) }),
        Make.nextUp({ seriesName: 'Faz tempo', lastActivityAt: daysAgo(90) }),
        Make.nextUp({ seriesName: 'Nunca', lastActivityAt: null }),
      ],
      undefined,
      NOW,
    )

    expect(shelf.active.map((s) => s.item.seriesName)).toEqual(['Ontem'])
    expect(shelf.paused.map((s) => s.item.seriesName)).toEqual(['Faz tempo'])
    expect(shelf.notStarted.map((s) => s.item.seriesName)).toEqual(['Nunca'])
  })

  it('revisão entra em andamento, sem contar episódios "devidos"', () => {
    const got = Make.seriesItem({ name: 'Game of Thrones', episodesTotal: 73, episodesAired: 73, episodesWatched: 73 })
    const dark = Make.seriesItem({ name: 'Dark Matter', episodesTotal: 20, episodesAired: 20, episodesWatched: 16 })
    const shelf = new NextUpShelf(
      [
        Make.nextUp({ seriesId: got.id, seriesName: got.name, lastActivityAt: daysAgo(0), isRewatch: true }),
        Make.nextUp({ seriesId: dark.id, seriesName: dark.name, lastActivityAt: daysAgo(2) }),
      ],
      [got, dark],
      NOW,
    )

    expect(shelf.active).toHaveLength(2)
    expect(shelf.active[0]).toMatchObject({ rewatch: true, backlog: null })
    expect(shelf.active[1]).toMatchObject({ rewatch: false, backlog: 4 })
    // Os 4 da Dark Matter esperam; a revisão não deve nada.
    expect(shelf.waiting).toBe(4)
    expect(shelf.rewatching).toBe(1)
  })

  it('está vazia só quando não sobra nada em nenhuma das três', () => {
    expect(new NextUpShelf([], undefined, NOW).isEmpty).toBe(true)
    expect(new NextUpShelf([Make.nextUp({ lastActivityAt: daysAgo(400) })], undefined, NOW).isEmpty).toBe(false)
  })
})
