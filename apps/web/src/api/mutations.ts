import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EpisodeCode } from '@/domain/EpisodeCode'
import { TrackingStatusInfo, type TrackingStatus } from '@/domain/TrackingStatus'
import { Fmt } from '@/lib/format'
import { api } from './RepriseApi'
import type { TrackingChange } from './types'
import { WatchCache } from './WatchCache'

/** O mínimo que as ações de episódio precisam saber — serve para EpisodeDto e EpisodeRefDto. */
export interface EpisodeTarget {
  seriesId: number
  seriesName?: string
  episode: { id: number; seasonNumber: number; episodeNumber: number }
}

const describe = (t: EpisodeTarget) => {
  const code = EpisodeCode.of(t.episode).toString()
  return t.seriesName ? `${t.seriesName} · ${code}` : code
}

const fail = (error: Error) => toast.error(error.message)

/**
 * As ações sobre episódios, com o comportamento que a pessoa espera em qualquer tela:
 * resposta imediata, "Desfazer" ao marcar e mensagem legível quando a API recusa.
 */
export function useEpisodeActions() {
  const client = useQueryClient()
  const cache = new WatchCache(client)

  const unmark = useMutation({
    mutationFn: (t: EpisodeTarget) => api.watching.unmark(t.episode.id),
    onMutate: (t) => cache.bump(t.seriesId, t.episode.id, -1),
    onError: (error, t, previous) => {
      cache.restore(t.seriesId, previous)
      fail(error)
    },
    onSuccess: (state, t) => {
      cache.settle(t.seriesId, state)
      toast(`${describe(t)} · exibição removida`)
    },
    onSettled: (_d, _e, t) => cache.invalidateAfterWatch(t.seriesId),
  })

  const mark = useMutation({
    mutationFn: (t: EpisodeTarget & { watchedAt?: Date }) => api.watching.mark(t.episode.id, t.watchedAt),
    onMutate: (t) => cache.bump(t.seriesId, t.episode.id, 1, t.watchedAt),
    onError: (error, t, previous) => {
      cache.restore(t.seriesId, previous)
      fail(error)
    },
    onSuccess: (state, t) => {
      cache.settle(t.seriesId, state)
      const what = state.watchCount > 1 ? `revisto (${state.watchCount}×)` : 'visto'
      toast.success(`${describe(t)} · ${what}`, {
        action: { label: 'Desfazer', onClick: () => unmark.mutate(t) },
      })
    },
    onSettled: (_d, _e, t) => cache.invalidateAfterWatch(t.seriesId),
  })

  const bulk = useMutation({
    mutationFn: (v: { seriesId: number; season: number; upToEpisode?: number }) =>
      v.upToEpisode === undefined
        ? api.watching.markSeason(v.seriesId, v.season)
        : api.watching.markUpTo(v.seriesId, v.season, v.upToEpisode),
    onError: fail,
    onSuccess: (marked) =>
      marked === 0
        ? toast('Nada a marcar: estava tudo em dia.')
        : toast.success(`${Fmt.plural(marked, 'episódio marcado', 'episódios marcados')}`),
    onSettled: (_d, _e, v) => cache.invalidateAfterWatch(v.seriesId),
  })

  return { mark, unmark, bulk }
}

export function useTrackingActions() {
  const client = useQueryClient()
  const cache = new WatchCache(client)

  const setStatus = useMutation({
    mutationFn: (v: { seriesId: number; status: TrackingStatus }) => api.series.setStatus(v.seriesId, v.status),
    onError: fail,
    onSuccess: (_d, v) => toast.success(`Movida para ${TrackingStatusInfo.plural(v.status)}`),
    onSettled: (_d, _e, v) => cache.invalidateAfterTracking([v.seriesId]),
  })

  const applyMany = useMutation({
    mutationFn: (changes: TrackingChange[]) => api.series.setStatuses(changes),
    onError: fail,
    onSuccess: (_d, changes) => toast.success(Fmt.plural(changes.length, 'série movida', 'séries movidas')),
    onSettled: (_d, _e, changes) => cache.invalidateAfterTracking(changes.map((c) => c.seriesId)),
  })

  return { setStatus, applyMany }
}

export function useAddSeries() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (tmdbId: number) => api.series.add(tmdbId),
    onError: fail,
    onSuccess: (result) => {
      toast.success(result.alreadyTracked ? `${result.name} já estava no acervo` : `${result.name} entrou no acervo`)
      void client.invalidateQueries({ queryKey: ['search'] })
      void new WatchCache(client).invalidateAfterTracking([result.seriesId])
    },
  })
}

export interface RewatchTarget {
  seriesId: number
  seriesName: string
}

/**
 * Tirar uma revisão do Continuar. O cartão some na hora e o aviso oferece "Desfazer" — o botão fica
 * ao lado do "Assisti", e um toque errado não pode custar uma ida à tela da série para consertar.
 */
export function useRewatchActions() {
  const client = useQueryClient()
  const cache = new WatchCache(client)

  const restore = useMutation({
    mutationFn: (t: RewatchTarget) => api.series.restoreRewatch(t.seriesId),
    onError: fail,
    onSettled: () => cache.invalidateNextUp(),
  })

  const dismiss = useMutation({
    mutationFn: (t: RewatchTarget) => api.series.dismissRewatch(t.seriesId),
    onMutate: (t) => cache.hideFromNextUp(t.seriesId),
    onError: (error, _t, previous) => {
      cache.restoreNextUp(previous)
      fail(error)
    },
    onSuccess: (_d, t) =>
      toast(`${t.seriesName} saiu do Continuar`, {
        description: 'Volta sozinha se você remarcar outro episódio dela.',
        action: { label: 'Desfazer', onClick: () => restore.mutate(t) },
      }),
    onSettled: () => cache.invalidateNextUp(),
  })

  return { dismiss, restore }
}
