import { clsx } from 'clsx'
import { useLayoutEffect, useRef, useState } from 'react'
import { type HeatCell, HeatmapYear } from '@/domain/HeatmapYear'
import { Duration } from '@/domain/Duration'
import { Fmt } from '@/lib/format'
import { useThemeColors } from '@/lib/useThemeColors'

const CELL = 12
const GAP = 3
const STEP = CELL + GAP
const LEFT = 28
const TOP = 18
const FILL = ['fill-heat-0', 'fill-heat-1', 'fill-heat-2', 'fill-heat-3', 'fill-heat-4'] as const
const WEEKDAYS: [number, string][] = [
  [1, 'seg'],
  [3, 'qua'],
  [5, 'sex'],
]

/**
 * O ano em quadrados, um por dia. Degraus fixos de episódios por dia (1 · 2–3 · 4–6 · 7+), a
 * mesma escala de calor do mapa de episódios. No celular a grade rola de lado e abre no fim —
 * os meses recentes são os que importam primeiro.
 */
export function YearHeatmap({ heatmap }: { heatmap: HeatmapYear }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ cell: HeatCell; x: number; y: number } | null>(null)
  // O canto do quadrado segue o design: arredondado na Brasa, quase reto na Sessão, reto na Grade.
  const rx = Math.min(3, useThemeColors().barRadius)
  const width = LEFT + heatmap.weeks.length * STEP
  const height = TOP + 7 * STEP

  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [heatmap])

  const show = (cell: HeatCell, column: number, row: number) => {
    const el = scroller.current
    const x = LEFT + column * STEP + CELL / 2 - (el?.scrollLeft ?? 0)
    setTip({ cell, x: Math.min(Math.max(x, 90), (el?.clientWidth ?? width) - 90), y: TOP + row * STEP })
  }

  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto pb-1" onScroll={() => setTip(null)}>
        <svg width={width} height={height} role="img" aria-label={`Exibições por dia em ${heatmap.year}`} className="block">
          {heatmap.months.map((m) => (
            <text key={m.label} x={LEFT + m.column * STEP} y={11} className="fill-ink-3 font-mono text-[10px]">
              {m.label}
            </text>
          ))}
          {WEEKDAYS.map(([row, label]) => (
            <text key={label} x={0} y={TOP + row * STEP + CELL - 2} className="fill-ink-3 font-mono text-[10px]">
              {label}
            </text>
          ))}
          <g onMouseLeave={() => setTip(null)}>
            {heatmap.weeks.map((week, column) =>
              week.map((cell, row) =>
                cell ? (
                  <rect
                    key={cell.iso}
                    x={LEFT + column * STEP}
                    y={TOP + row * STEP}
                    width={CELL}
                    height={CELL}
                    rx={rx}
                    className={clsx(cell.future ? 'fill-transparent stroke-line' : FILL[cell.level], 'transition-opacity hover:opacity-80')}
                    onMouseEnter={() => show(cell, column, row)}
                  />
                ) : null,
              ),
            )}
          </g>
        </svg>
      </div>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-pop"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <span className="font-semibold">{Fmt.pattern(tip.cell.date, "EEEE, d 'de' MMM")}</span>
          <span className="block opacity-75">
            {tip.cell.exhibitions === 0
              ? tip.cell.future
                ? 'ainda não chegou'
                : 'nada assistido'
              : `${Fmt.plural(tip.cell.exhibitions, 'episódio', 'episódios')} · ${Duration.ofSeconds(tip.cell.seconds).toShort()}`}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink-3" aria-label="Legenda: episódios por dia">
        <span className="mr-1">episódios/dia</span>
        {HeatmapYear.LEGEND.map((step) => (
          <span key={step.level} className="flex items-center gap-1">
            <svg width={CELL} height={CELL} aria-hidden>
              <rect width={CELL} height={CELL} rx={rx} className={FILL[step.level]} />
            </svg>
            <span className="code mr-1.5">{step.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
