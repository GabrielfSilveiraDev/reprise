import type { SeriesListItem } from '@/api/types'
import { Skeleton } from '@/ui/Feedback'
import { SeriesCard } from './SeriesCard'

/** O acervo da Brasa: grade de pôsteres com barra de progresso e uma frase. `null` = carregando. */
export function CollectionBrasa({ series }: { series: SeriesListItem[] | null }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {series === null
        ? Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] rounded-poster" />
              <Skeleton className="mt-2.5 h-4 w-3/4" />
            </div>
          ))
        : series.map((s, i) => <SeriesCard key={s.id} series={s} index={i} />)}
    </div>
  )
}
