import { describe, expect, it } from 'vitest'
import { Make } from '@/test/factories'
import { PremiereAgenda } from './PremiereAgenda'
import { ReleaseClock } from './ReleaseClock'

// Quinta-feira, 24/09/2026, 18h em Brasília.
const clock = new ReleaseClock(new Date('2026-09-24T21:00:00Z'))

describe('PremiereAgenda', () => {
  const tonight = Make.premiere({ seriesName: 'Hoje à noite', releasesAt: '2026-09-25T01:00:00Z', airDate: '2026-09-24' })
  const us = Make.premiere({ seriesName: 'Silo', releasesAt: '2026-09-25T07:00:00Z', airDate: '2026-09-24' })
  const sunday = Make.premiere({ seriesName: 'Domingo', releasesAt: '2026-09-27T20:00:00Z', airDate: '2026-09-27', isSeasonPremiere: true })
  const march = Make.premiere({ seriesName: 'Longe', releasesAt: '2027-03-10T08:00:00Z', airDate: '2027-03-10', isSeasonPremiere: true })
  const march2 = Make.premiere({ seriesName: 'Aaa', releasesAt: '2027-03-20T08:00:00Z', airDate: '2027-03-20' })

  const agenda = new PremiereAgenda([march2, sunday, us, march, tonight], clock)

  it('ordena pelo instante de liberação', () => {
    expect(agenda.entries.map((e) => e.premiere.seriesName)).toEqual(['Hoje à noite', 'Silo', 'Domingo', 'Longe', 'Aaa'])
  })

  it('agrupa pelo dia local: a estreia americana de quinta cai na sexta', () => {
    const sections = agenda.sections()
    expect(sections.map((s) => [s.kind, s.title])).toEqual([
      ['day', 'Hoje'],
      ['day', 'Amanhã'],
      ['day', 'Domingo'],
      ['month', 'Março'],
    ])
    expect(sections[1]!.entries[0]!.premiere.seriesName).toBe('Silo')
    expect(sections[3]!.subtitle).toBe('2027')
    expect(sections[3]!.entries).toHaveLength(2)
  })

  it('filtra só estreias de temporada', () => {
    const names = agenda.sections({ seasonPremieresOnly: true }).flatMap((s) => s.entries.map((e) => e.premiere.seriesName))
    expect(names).toEqual(['Domingo', 'Longe'])
  })

  it('recorta pelos próximos dias de calendário', () => {
    expect(agenda.within(2).map((e) => e.premiere.seriesName)).toEqual(['Hoje à noite', 'Silo'])
    expect(agenda.within(7)).toHaveLength(3)
  })
})
