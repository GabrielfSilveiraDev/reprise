import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Queries } from '@/api/queries'
import type { NextUpItem } from '@/api/types'
import { useSession } from '@/app/useSession'
import { NextUpShelf } from '@/domain/NextUpShelf'
import { type AgendaEntry, PremiereAgenda } from '@/domain/PremiereAgenda'
import { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'

/** "Bom dia" e companhia, pela hora local. */
export class Greeting {
  static of(now: Date): string {
    const h = now.getHours()
    if (h < 5) return 'Boa madrugada'
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }
}

/** Quantos dias à frente a tela inicial mostra de estreias. */
export const SOON_DAYS = 8

export interface HomeModel {
  now: Date
  clock: ReleaseClock
  greeting: string
  firstName: string
  nextUp: UseQueryResult<NextUpItem[]>
  shelf: NextUpShelf | null
  /** Estreias dos próximos {@link SOON_DAYS} dias, no fuso de quem olha. */
  soon: AgendaEntry[]
  /** Uma frase sobre o dia ("2 séries em andamento · 5 episódios esperando…"), ou nulo sem fila. */
  summary: string | null
}

/**
 * O que a tela inicial sabe, independente de como cada design a desenha. As três versões
 * (Brasa, Sessão, Grade) recebem este modelo pronto — a regra de "o que assistir agora" existe
 * num lugar só, e trocar de design não pode mudar o que aparece, só como.
 */
export function useHomeModel(): HomeModel {
  const session = useSession()
  const nextUp = useQuery(Queries.nextUp())
  const series = useQuery(Queries.seriesList())
  const premieres = useQuery(Queries.premieres())
  const [now] = useState(() => new Date())

  const shelf = useMemo(() => (nextUp.data ? new NextUpShelf(nextUp.data, series.data, now) : null), [nextUp.data, series.data, now])
  const clock = useMemo(() => new ReleaseClock(now), [now])
  const soon = useMemo(() => (premieres.data ? new PremiereAgenda(premieres.data, clock).within(SOON_DAYS) : []), [premieres.data, clock])

  return {
    now,
    clock,
    greeting: Greeting.of(now),
    firstName: session?.displayName.split(/\s+/)[0] ?? '',
    nextUp,
    shelf,
    soon,
    summary: shelf && !shelf.isEmpty ? summarize(shelf, soon.length) : null,
  }
}

function summarize(shelf: NextUpShelf, premieres: number): string {
  const running = shelf.active.length - shelf.rewatching
  const parts: string[] = []
  if (running > 0) {
    parts.push(
      `${Fmt.plural(running, 'série em andamento', 'séries em andamento')} · ${Fmt.plural(shelf.waiting, 'episódio esperando', 'episódios esperando')}`,
    )
  }
  if (shelf.rewatching > 0) parts.push(Fmt.plural(shelf.rewatching, 'revisão em curso', 'revisões em curso'))
  if (parts.length === 0) parts.push('Nenhuma série em andamento no último mês')

  let text = `${parts.join(' · ')}.`
  if (premieres > 0) text += ` ${Fmt.plural(premieres, 'estreia', 'estreias')} nos próximos dias.`
  return text
}
