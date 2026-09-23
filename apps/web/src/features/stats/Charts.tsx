import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Duration } from '@/domain/Duration'
import type { BarDatum } from '@/domain/StatsTimeline'
import { Fmt } from '@/lib/format'
import { useThemeColors } from '@/lib/useThemeColors'

/**
 * Colunas de uma série só (exibições por período). Uma cor, sem legenda — o título diz o que é;
 * barra de no máximo 24px com ponta arredondada e base reta; grade de fio, só horizontal.
 */
export function ColumnChart({ data, height = 220 }: { data: BarDatum[]; height?: number }) {
  const c = useThemeColors()
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={c.line} strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.ink3, fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: c.ink3, fontSize: 11 }} allowDecimals={false} width={44} tickFormatter={(v: number) => Fmt.compact(v)} />
          <Tooltip cursor={{ fill: c.surface2 }} content={<ChartTooltip />} />
          <Bar dataKey="exhibitions" fill={c.accent} radius={[c.barRadius, c.barRadius, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: BarDatum }[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-pop">
      <p className="font-semibold">{d.full}</p>
      <p className="opacity-75">
        {Fmt.plural(d.exhibitions, 'exibição', 'exibições')} · {Duration.ofSeconds(d.seconds).toShort()}
      </p>
    </div>
  )
}
