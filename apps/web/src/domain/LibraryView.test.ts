import { describe, expect, it } from 'vitest'
import { Make } from '@/test/factories'
import { LibraryView } from './LibraryView'

describe('LibraryView', () => {
  const pokemon = Make.seriesItem({ name: 'Pokémon', episodesAired: 100, episodesWatched: 40, lastWatchedAt: '2024-01-01T00:00:00Z' })
  const dark = Make.seriesItem({ name: 'Dark', status: 'Finished', episodesTotal: 26, episodesAired: 26, episodesWatched: 26, lastWatchedAt: '2020-06-01T00:00:00Z' })
  const silo = Make.seriesItem({ name: 'Silo', episodesTotal: 20, episodesAired: 20, episodesWatched: 18, lastWatchedAt: '2026-09-01T00:00:00Z' })
  const never = Make.seriesItem({ name: 'Andor', status: 'ForLater', episodesWatched: 0, lastWatchedAt: null })
  const view = new LibraryView([pokemon, dark, silo, never])

  it('conta por estado', () => {
    expect(view.counts()).toEqual({ Following: 2, ForLater: 1, Finished: 1, Archived: 0, todas: 4 })
  })

  it('busca ignora acento e caixa', () => {
    expect(view.apply({ filter: 'todas', sort: 'nome', text: 'POKEMON' }).map((s) => s.name)).toEqual(['Pokémon'])
  })

  it('ordena por atividade, com quem nunca assistiu no fim', () => {
    expect(view.apply({ filter: 'todas', sort: 'atividade', text: '' }).map((s) => s.name)).toEqual(['Silo', 'Pokémon', 'Dark', 'Andor'])
  })

  it('ordena por pendentes e filtra por estado', () => {
    expect(view.apply({ filter: 'Following', sort: 'pendentes', text: '' }).map((s) => s.name)).toEqual(['Pokémon', 'Silo'])
  })
})
