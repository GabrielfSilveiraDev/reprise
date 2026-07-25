import { useState } from 'react';
import { formatRuntime } from '@reprise/shared';
import type { CalendarDay } from '../api/queries';
import './CalendarHeatmap.css';

interface Props {
  year: number;
  days: readonly CalendarDay[];
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LEVELS = 4;

/**
 * Heatmap de calendário. Rampa sequencial de UMA cor, clara → escura — magnitude
 * nunca vira arco-íris. Os quatro degraus reusam a mesma rampa da trilha de episódios,
 * já validada em contraste nos dois temas.
 *
 * Os quartis são calculados sobre os dias COM atividade, não sobre o ano inteiro: com
 * 300 dias vazios, qualquer escala baseada na média achataria tudo no primeiro degrau.
 */
export function CalendarHeatmap({ year, days }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const values = days.map((d) => d.exhibitions).sort((a, b) => a - b);
  const quartile = (q: number) => values[Math.floor((values.length - 1) * q)] ?? 0;
  const cuts = [quartile(0.25), quartile(0.5), quartile(0.75)];

  const levelOf = (exhibitions: number) => {
    if (exhibitions <= 0) return 0;
    if (exhibitions <= cuts[0]!) return 1;
    if (exhibitions <= cuts[1]!) return 2;
    if (exhibitions <= cuts[2]!) return 3;
    return LEVELS;
  };

  // Grade semanal: começa no domingo anterior a 1º de janeiro.
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(Date.UTC(year, 11, 31));

  const weeks: { iso: string; inYear: boolean; month: number }[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: { iso: string; inYear: boolean; month: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = cursor.toISOString().slice(0, 10);
      week.push({ iso, inYear: cursor.getUTCFullYear() === year, month: cursor.getUTCMonth() });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  const total = days.reduce((sum, d) => sum + d.exhibitions, 0);

  return (
    <figure className="heatmap">
      <figcaption className="chart__title">
        {year} — {total} {total === 1 ? 'exibição' : 'exibições'} em {days.length}{' '}
        {days.length === 1 ? 'dia' : 'dias'}
      </figcaption>

      <div className="heatmap__scroll">
        <div className="heatmap__months" aria-hidden="true">
          {weeks.map((week, i) => {
            const first = week[0]!;
            const previous = weeks[i - 1]?.[0];
            const novoMes = first.inYear && (!previous || previous.month !== first.month);
            return (
              <span key={first.iso} className="heatmap__month">
                {novoMes ? MONTHS[first.month] : ''}
              </span>
            );
          })}
        </div>

        <div className="heatmap__grid" role="img" aria-label={`Calendário de exibições em ${year}`}>
          {weeks.map((week) => (
            <div key={week[0]!.iso} className="heatmap__week">
              {week.map((day) => {
                const entry = byDate.get(day.iso);
                const level = day.inYear ? levelOf(entry?.exhibitions ?? 0) : -1;
                return (
                  <span
                    key={day.iso}
                    className="heatmap__cell"
                    data-level={level}
                    onMouseEnter={() => day.inYear && setHovered(day.iso)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {hovered === day.iso ? (
                      <span className="chart__tip" role="tooltip">
                        {entry
                          ? `${day.iso}: ${entry.exhibitions} exibições · ${formatRuntime(entry.seconds)}`
                          : `${day.iso}: nada assistido`}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap__legend">
        <span>menos</span>
        <span className="heatmap__swatches" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="heatmap__cell" data-level={l} />
          ))}
        </span>
        <span>mais</span>
        <span className="heatmap__weekdays">
          {WEEKDAYS.filter((_, i) => i % 2 === 1).join(' · ')}
        </span>
      </div>

      <details className="chart__table">
        <summary>Ver como tabela ({days.length} dias com atividade)</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Exibições</th>
              <th scope="col">Tempo</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row" className="tabular">
                  {d.date}
                </th>
                <td className="tabular">{d.exhibitions}</td>
                <td className="tabular">{formatRuntime(d.seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
