import { useState } from 'react';
import { formatPercent, formatRuntime, formatTotalTime, formatWatchedAt } from '@reprise/shared';
import { useCalendar, useStatsOverview } from '../api/queries';
import { BarChart } from '../components/BarChart';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { QueryState } from '../components/QueryState';
import './StatsPage.css';

/**
 * Painel de estatísticas.
 *
 * O filtro fica numa linha única acima de tudo e reescopa TODOS os gráficos — filtro
 * por cartão faria cada número responder a uma pergunta diferente.
 *
 * As exibições de backfill ficam fora por padrão. São as 10.348 marcações que o TV Time
 * gravou todas na mesma data quando você marcou temporadas inteiras: mantê-las faria
 * dezembro/2025 engolir o gráfico e mentir sobre quando você de fato assistiu.
 */
export function StatsPage() {
  const [includeBackfill, setIncludeBackfill] = useState(false);
  const overview = useStatsOverview(includeBackfill);
  const [year, setYear] = useState<number | null>(null);

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Estatísticas</p>
        <h1>Seu histórico</h1>
      </header>

      <div className="filters">
        <label className="toggle">
          <input
            type="checkbox"
            checked={includeBackfill}
            onChange={(e) => setIncludeBackfill(e.target.checked)}
          />
          <span>Incluir marcações em massa</span>
        </label>
        <p className="filters__hint">
          Marcações em massa são as que o TV Time gravou todas na mesma data ao marcar
          temporadas inteiras. Distorcem qualquer leitura temporal, por isso ficam fora.
        </p>
      </div>

      <QueryState query={overview}>
        {(data) => {
          const anoAtivo = year ?? data.availableYears[0] ?? new Date().getFullYear();

          return (
            <>
              {!includeBackfill && data.summary.backfillExhibitions > 0 ? (
                <p className="notice" role="status">
                  <strong className="tabular">
                    {data.summary.backfillExhibitions.toLocaleString('pt-BR')}
                  </strong>{' '}
                  exibições em massa estão fora destes números. Elas são a maior parte do seu
                  histórico importado, mas todas carregam a mesma data — inclui-las diria que você
                  assistiu tudo num dia só.
                </p>
              ) : null}

              <section className="tiles" aria-label="Resumo">
                <Tile label="Tempo assistido" value={formatTotalTime(data.summary.totalSeconds)} />
                <Tile label="Exibições" value={data.summary.exhibitions.toLocaleString('pt-BR')} />
                <Tile
                  label="Episódios distintos"
                  value={data.summary.distinctEpisodes.toLocaleString('pt-BR')}
                />
                <Tile label="Séries" value={String(data.summary.seriesCount)} />
                <Tile
                  label="Taxa de rewatch"
                  value={formatPercent(data.summary.rewatchRate)}
                  hint="quanto das exibições foi revisita"
                />
                <Tile
                  label="Maior sequência"
                  value={`${data.streaks.longestDays} d`}
                  hint={
                    data.streaks.currentDays > 0
                      ? `atual: ${data.streaks.currentDays} d`
                      : 'sem sequência ativa'
                  }
                />
              </section>

              <p className="period">
                De {formatWatchedAt(data.summary.firstWatchedAt)} a{' '}
                {formatWatchedAt(data.summary.lastWatchedAt)}.
              </p>

              {data.summary.exhibitions === 0 ? (
                <p className="state">
                  Nenhuma exibição fora das marcações em massa. Ligue o filtro acima para ver o
                  histórico importado.
                </p>
              ) : (
                <>
                  <hr className="divider" />

                  <div className="charts">
                    <BarChart
                      title="Tempo assistido por ano"
                      orientation="vertical"
                      bars={data.byYear.map((b) => ({
                        key: b.label,
                        label: b.label,
                        value: b.seconds,
                        detail: `${b.label}: ${formatRuntime(b.seconds)} em ${b.exhibitions} exibições`,
                      }))}
                      format={(v) => formatTotalTime(v)}
                    />

                    <BarChart
                      title="Exibições por mês"
                      orientation="vertical"
                      bars={data.byMonth.map((b) => ({
                        key: b.label,
                        label: b.label.slice(2),
                        value: b.exhibitions,
                        detail: `${b.label}: ${b.exhibitions} exibições · ${formatRuntime(b.seconds)}`,
                      }))}
                      format={(v) => String(v)}
                    />
                  </div>

                  <hr className="divider" />

                  <BarChart
                    title="Séries por tempo assistido"
                    orientation="horizontal"
                    bars={data.topSeries.map((s) => ({
                      key: String(s.seriesId),
                      label: s.name,
                      value: s.seconds,
                      detail: `${s.name}: ${formatRuntime(s.seconds)} · ${s.exhibitions} exibições em ${s.distinctEpisodes} episódios`,
                    }))}
                    format={(v) => formatTotalTime(v)}
                  />

                  <hr className="divider" />

                  <section aria-label="Calendário">
                    <div className="year-picker">
                      <span className="eyebrow">Ano</span>
                      {data.availableYears.map((y) => (
                        <button
                          key={y}
                          type="button"
                          className="btn btn--quiet"
                          aria-pressed={y === anoAtivo}
                          data-active={y === anoAtivo}
                          onClick={() => setYear(y)}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                    <CalendarSection year={anoAtivo} includeBackfill={includeBackfill} />
                  </section>
                </>
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tile">
      <p className="tile__label">{label}</p>
      {/* Figura proporcional, não tabular: em corpo grande, dígitos de largura fixa ficam frouxos. */}
      <p className="tile__value">{value}</p>
      {hint ? <p className="tile__hint">{hint}</p> : null}
    </div>
  );
}

function CalendarSection({ year, includeBackfill }: { year: number; includeBackfill: boolean }) {
  const query = useCalendar(year, includeBackfill);
  return (
    <QueryState query={query}>
      {(days) => <CalendarHeatmap year={year} days={days} />}
    </QueryState>
  );
}
