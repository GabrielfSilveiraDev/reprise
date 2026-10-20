import { describe, expect, it } from 'vitest'
import { Make } from '@/test/factories'
import { ReturnNews } from './ReturnNews'

const NOW = new Date('2026-10-20T21:00:00-03:00')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

describe('ReturnNews', () => {
  const news = new ReturnNews(NOW)

  it('a série que voltou com temporada nova é notícia', () => {
    const edgerunners = Make.seriesItem({ name: 'Cyberpunk: Edgerunners', returnedAt: daysAgo(0), lastWatchedAt: daysAgo(1490) })
    expect(news.isNews(edgerunners)).toBe(true)
    expect(news.returnedAt(edgerunners)).toEqual(new Date(daysAgo(0)))
  })

  it('série sem volta não é notícia, por mais parada que esteja', () => {
    expect(news.isNews(Make.seriesItem({ returnedAt: null, lastWatchedAt: daysAgo(900) }))).toBe(false)
  })

  it('assistir depois da volta encerra a notícia — já é só mais uma série em andamento', () => {
    const vista = Make.seriesItem({ returnedAt: daysAgo(3), lastWatchedAt: daysAgo(1) })
    expect(news.isNews(vista)).toBe(false)
  })

  it('a notícia dura duas semanas, contadas em dias do calendário', () => {
    expect(news.isNews(Make.seriesItem({ returnedAt: daysAgo(ReturnNews.DAYS) }))).toBe(true)
    expect(news.isNews(Make.seriesItem({ returnedAt: daysAgo(ReturnNews.DAYS + 1) }))).toBe(false)
  })

  it('fora de Assistindo não é notícia, mesmo com a marca', () => {
    expect(news.isNews(Make.seriesItem({ status: 'Finished', returnedAt: daysAgo(1) }))).toBe(false)
  })

  it('lista as que voltaram, a mais recente primeiro', () => {
    const antiga = Make.seriesItem({ name: 'Antiga', returnedAt: daysAgo(6) })
    const nova = Make.seriesItem({ name: 'Nova', returnedAt: daysAgo(1) })
    const parada = Make.seriesItem({ name: 'Parada', returnedAt: null })

    expect(news.of([antiga, parada, nova]).map((s) => s.name)).toEqual(['Nova', 'Antiga'])
  })
})
