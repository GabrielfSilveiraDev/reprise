import { Link } from '@tanstack/react-router'
import { EpisodeCode } from '@/domain/EpisodeCode'
import type { AgendaEntry } from '@/domain/PremiereAgenda'
import type { ReleaseClock } from '@/domain/ReleaseClock'
import { Fmt } from '@/lib/format'
import { Badge } from '@/ui/Controls'
import { Poster } from '@/ui/Poster'

/** Faixa horizontal de estreias próximas. No celular rola de lado, com encaixe por cartão. */
export function PremiereRail({ entries, clock }: { entries: AgendaEntry[]; clock: ReleaseClock }) {
  return (
    <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {entries.map(({ premiere, instant }) => {
        const code = EpisodeCode.of(premiere)
        const day = clock.dayLabel(instant)
        return (
          <li key={premiere.episodeId} className="w-[148px] shrink-0 snap-start">
            <Link to="/serie/$seriesId" params={{ seriesId: premiere.seriesId }} search={{ ep: premiere.episodeId }} className="group block">
              <div className="relative">
                <Poster path={premiere.posterPath} name={premiere.seriesName} size="w185" sizes="148px" className="transition-transform duration-300 group-hover:-translate-y-0.5" />
                <span className="absolute inset-x-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-center text-[11px] font-semibold text-white backdrop-blur-sm">
                  {day} · <span className="code">{Fmt.time(instant)}</span>
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium group-hover:text-accent-ink">{premiere.seriesName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                <span className="code">{code.toString()}</span>
                {premiere.isSeasonPremiere && <Badge tone="accent">estreia</Badge>}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
