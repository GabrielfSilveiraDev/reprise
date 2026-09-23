import { describe, expect, it } from 'vitest'
import { Make } from '@/test/factories'
import { CompletionAdvisor } from './CompletionAdvisor'
import { SeriesProgress } from './SeriesProgress'

const progress = (total: number, aired: number, watched: number, productionStatus: string | null = 'Returning Series') =>
  new SeriesProgress({ episodesTotal: total, episodesAired: aired, episodesWatched: watched, productionStatus })

describe('SeriesProgress', () => {
  it('separa o que falta assistir do que falta lançar', () => {
    const p = progress(16, 12, 9)
    expect(p.backlog).toBe(3)
    expect(p.upcoming).toBe(4)
    expect(p.phase).toBe('behind')
    expect(p.summary).toBe('faltam 3')
  })

  it('em dia com episódios anunciados não é "atrasada"', () => {
    const p = progress(12, 10, 10)
    expect(p.phase).toBe('caught-up')
    expect(p.summary).toBe('em dia · 2 a caminho')
  })

  it('completa só quando a produção acabou e não há nada por lançar', () => {
    expect(progress(10, 10, 10, 'Ended').phase).toBe('complete')
    expect(progress(10, 10, 10, 'Canceled').phase).toBe('complete')
    expect(progress(10, 10, 10, 'Returning Series').phase).toBe('caught-up')
    expect(progress(12, 10, 10, 'Ended').phase).toBe('caught-up')
  })

  it('a régua é o total: anunciar temporada não faz o progresso andar para trás', () => {
    expect(progress(20, 10, 10).ratio).toBe(0.5)
    expect(progress(0, 0, 0).ratio).toBe(0)
  })

  it('distingue série sem catálogo de série não começada', () => {
    expect(progress(0, 0, 0).phase).toBe('no-catalog')
    expect(progress(8, 8, 0).summary).toBe('8 para começar')
    expect(progress(8, 0, 0).summary).toBe('ainda não estreou')
  })
})

describe('CompletionAdvisor', () => {
  it('sugere só séries em Assistindo, encerradas e vistas por inteiro', () => {
    const done = Make.seriesItem({ name: 'Dark', productionStatus: 'Ended', episodesTotal: 26, episodesAired: 26, episodesWatched: 26 })
    const running = Make.seriesItem({ productionStatus: 'Returning Series', episodesTotal: 8, episodesAired: 8, episodesWatched: 8 })
    const behind = Make.seriesItem({ productionStatus: 'Ended', episodesTotal: 10, episodesAired: 10, episodesWatched: 9 })
    const archived = Make.seriesItem({ status: 'Archived', productionStatus: 'Ended', episodesTotal: 5, episodesAired: 5, episodesWatched: 5 })

    const advisor = new CompletionAdvisor()
    const suggested = advisor.suggest([done, running, behind, archived])

    expect(suggested.map((s) => s.name)).toEqual(['Dark'])
    expect(advisor.toChanges(suggested)).toEqual([{ seriesId: done.id, status: 'Finished' }])
  })
})
